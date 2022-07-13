from celery import Celery
from requests_oauthlib import OAuth1Session
import json
import psycopg2
from datetime import datetime
from queries import CREATE_TABLE_Q, INSERT_Q
import time

app = Celery('tasks', broker='redis://localhost', backend = 'redis://localhost')

API_KEY = "API_KEY"
API_SECRET = "API_SECRET"


POSTGRES_PARAMS = "host=POSTGRES_HOST dbname=POSTGRES_DB user=POSTGRES_USER password=POSTGRES_PASS"

LOG_FILE = "LOG_FILE"

FACTOR_1_DIVISIONS = 24

@app.task(bind=True)
def get_statuses(self, token, secret, id, uname):
    tic = time.time()

    # f = open(LOG_FILE, 'a')
    # f.write(time.strftime("%b %d %Y %H:%M:%S") + "\tUser " + uname + " Logged in successfully\tuid: " + str(id) + "\n")
    # f.close()

    self.update_state(state='PROGRESS', meta={'current': 0})
    twitter = OAuth1Session(API_KEY, client_secret=API_SECRET, resource_owner_key=token, resource_owner_secret=secret)
    r = twitter.get("https://api.twitter.com/1.1/statuses/home_timeline.json", params={'count': 200, 'exclude_replies': 'true', 'include_entities': 'true', 'tweet_mode': 'extended'})
    j1 = json.loads(r.content.decode())
    if 'errors' in j1:
        return {'state': 'FAILURE', 'msg': j1['errors'][0]['message']}
    self.update_state(state='PROGRESS', meta={'current': 33})
    r = twitter.get("https://api.twitter.com/1.1/statuses/home_timeline.json", params={'count': 200, 'exclude_replies': 'true', 'include_entities': 'true', 'tweet_mode': 'extended', 'max_id': int(j1[-1]['id']) - 1 })
    j2 = json.loads(r.content.decode())
    self.update_state(state='PROGRESS', meta={'current': 66})
    r = twitter.get("https://api.twitter.com/1.1/statuses/home_timeline.json", params={'count': 200, 'exclude_replies': 'true', 'include_entities': 'true', 'tweet_mode': 'extended', 'max_id': int(j2[-1]['id']) - 1 })
    j3 = json.loads(r.content.decode())
    self.update_state(state='PROGRESS', meta={'current': 90})
    print(time.time() - tic)
    j = []
    j.extend(j1)
    j.extend(j2)
    j.extend(j3)

    statuses = []

    for stat in j:
        x = {}

        x['retweeted_by_uname'] = "NULL"
        x['retweeted_by_name'] = "NULL"
        if "retweeted_status" in stat:
            x['retweeted_by_uname'] = stat['user']['screen_name']
            x['retweeted_by_name'] = stat['user']['name']

            stat = stat['retweeted_status']
        
        x['uname'] = stat['user']['screen_name']
        x['name'] = stat['user']['name']
        x['profile_pic'] = stat['user']['profile_image_url']
        x['full_text'] = stat['full_text']
        x['tweet_id'] = stat['id_str']
        x['image1'] = "NULL"
        x['image2'] = "NULL"
        x['image3'] = "NULL"
        x['image4'] = "NULL"
        x['vid'] = "NULL"
        x['vid_prev'] = "NULL"
        x['quote_uname'] = "NULL"
        x['quote_name'] = "NULL"
        x['quote_profile_pic'] = "NULL"
        x['quote_text'] = "NULL"
        
        x['lang'] = stat['lang']

        if 'extended_entities' in stat:
            for i in range(len(stat['extended_entities']['media'])):
                m = stat['extended_entities']['media'][i]
                if 'video_info' not in m:
                    x['image'+str(i+1)] = m['media_url']
                else:
                    x['vid_prev'] = m['media_url']
        
        if 'quoted_status' in stat:
            x['quote_uname'] = stat['quoted_status']['user']['screen_name']
            x['quote_name'] = stat['quoted_status']['user']['name']
            x['quote_profile_pic'] = stat['quoted_status']['user']['profile_image_url']
            x['quote_text'] = stat['quoted_status']['full_text']

        x['likes'] = stat['favorite_count']
        x['retweets'] = stat['retweet_count']
        x['created_at_dt'] = datetime.strptime(stat['created_at'], "%a %b %d %H:%M:%S %z %Y")  # "created at" datetime object
        x['created_at'] = x['created_at_dt'].strftime("%Y-%m-%d %H:%M:%S")  # "created at" as string

        statuses.append(x)
    
    
    sorted_by_factor1 = sorted(statuses, key=lambda x: x['created_at_dt'].timestamp())  # sorted by time
    #sorted_by_factor2 = sorted(statuses, key=lambda x: float(x['likes']))  # sorted by likes

    sorted_stats = []
    section_size_1 = len(sorted_by_factor1) // FACTOR_1_DIVISIONS
    tmp = []
    for i in range(len(sorted_by_factor1)):
        sorted_by_factor1[i]['x'] = i // section_size_1
        tmp.append(sorted_by_factor1[i])

        if (i % section_size_1 == section_size_1 - 1 or i == (len(sorted_by_factor1) - 1)):
            tmp.sort(key=lambda x: float(x['likes']))  # sorting each factor 1 division by factor 2
            for j in range(len(tmp)):
                tmp[j]['y'] = j
                sorted_stats.append(tmp[j])
            tmp = []
    print(time.time() - tic)
    conn = psycopg2.connect(POSTGRES_PARAMS)
    cur = conn.cursor()
    cur.execute(CREATE_TABLE_Q % ("t" + id))

    i = 0
    for x in sorted_stats:
        cur.execute(INSERT_Q.format("t" + id), (x['tweet_id'], x['uname'], x['name'], x['profile_pic'], x['full_text'], x['image1'], x['image2'], x['image3'], x['image4'], x['vid'], x['vid_prev'],
        x['quote_uname'], x['quote_name'], x['quote_profile_pic'], x['quote_text'], x['retweeted_by_uname'], x['retweeted_by_name'], x['likes'], x['retweets'],
        x['created_at'], x['lang'], x['x'], x['y']))
        i+=1

    cur.close()
    conn.commit()
    print(time.time() - tic)
    
    return {'state': 'SUCCESS'}
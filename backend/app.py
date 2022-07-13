from flask import Flask, request, redirect, Response, jsonify
from markupsafe import escape
from requests_oauthlib import OAuth1Session
from tasks import get_statuses
import uuid
import psycopg2
import redis

API_KEY = "API_KEY"
API_SECRET = "API_SECRET"

REDIS_HOST = "REDIS_HOST"

POSTGRES_PARAMS = "host=POSTGRES_HOST dbname=POSTGRES_DB user=POSTGRES_USER password=POSTGRES_PASS"

OAUTH_CALLBACK = "http://127.0.0.1:5000/start"

MAIN_PAGE_URL = "http://127.0.0.1:8000/view.html"

app = Flask(__name__)

@app.route('/twitter_authenticate', methods=['GET'])
def twitter_authenticate():
    twitter = OAuth1Session(API_KEY, client_secret=API_SECRET)
    r = twitter.get("https://api.twitter.com/oauth/request_token", params={"oauth_callback": OAUTH_CALLBACK})
    print(r.content)
    token = r.content.decode().split('&')[0].split('=')[1]

    response = Response("https://api.twitter.com/oauth/authorize?oauth_token={}".format(token))
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.route('/start', methods=['GET'])
def start():
    token = request.args.get('oauth_token', '')
    verifier = request.args.get('oauth_verifier', '')

    twitter = OAuth1Session(API_KEY, client_secret=API_SECRET, resource_owner_key=token, verifier=verifier)
    res = twitter.fetch_access_token('https://api.twitter.com/oauth/access_token')
    
    uid = str(uuid.uuid4()).replace('-', '')
    t = get_statuses.apply_async(args=(res['oauth_token'], res['oauth_token_secret'], uid, str(res['screen_name'])))

    rd = redis.Redis(host=REDIS_HOST)
    rd.set("tid_"+uid, str(t.task_id), ex = 36000)
    rd.set("uname_"+uid, str(res['screen_name']), ex = 36000)

    return redirect(MAIN_PAGE_URL + "?id=" + uid, code=307)

@app.route('/get_results', methods=['GET'])
def get_results():
    uid = request.args.get('id', '')

    rd = redis.Redis(host=REDIS_HOST)
    tid = rd.get("tid_"+uid).decode()
    uname = rd.get("uname_"+uid).decode()
    try:
        task = get_statuses.AsyncResult(tid)
        state = task.state
    except Exception:
        state = None
    
    if state == "PROGRESS":
        response =jsonify({'state': "PROGRESS", 'current': task.result['current']})
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    
    elif state == "SUCCESS" or state == None:
        conn = psycopg2.connect(POSTGRES_PARAMS)
        cur = conn.cursor()
        try:
            cur.execute("""SELECT * from {};""".format("t"+uid))
            data = cur.fetchall()
            cur.close()

            #  TODO: Drop the table

            response =jsonify({"state": "COMPLETED", "data": data, "uname": uname})
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
        except Exception:
            response =jsonify({"state": "NOT FOUND", "data": []})
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
    else:
        response =jsonify({"state": state})
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response 

@app.route('/get_status', methods=['GET'])
def get_status():
    uid = request.args.get('id', '')

    rd = redis.Redis(host=REDIS_HOST)
    tid = rd.get("tid_"+uid)
    try:
        task = get_statuses.AsyncResult(tid)
        state = task.state
        print(task.result, state)
    except Exception:
        state = None
        task = None
    
    if state == "PROGRESS":
        response = jsonify({'state': "PROGRESS", 'current': task.result['current']})
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    
    elif state == "SUCCESS" or state == None:
        if state == "SUCCESS":
            if task.result['state'] == 'FAILURE':  #  state determines if task was completed succesfully result['state'] indicates if there was no errors during the process
                response =jsonify({"state": "FAILURE", 'msg': task.result['msg']})
                response.headers["Access-Control-Allow-Origin"] = "*"
                return response
        
        conn = psycopg2.connect(POSTGRES_PARAMS)
        cur = conn.cursor()
        try:
            cur.execute("""SELECT id from {};""".format("t"+uid))
            cur.close()
            response =jsonify({"state": "COMPLETED"})
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
        except Exception:
            response =jsonify({"state": "NOT FOUND"})
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
    elif state == "FAILURE":
        response =jsonify({"state": "FAILURE", "msg": "Server went down :((("})
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    else:
        response =jsonify({"state": state})
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response 

if __name__ == '__main__':
    app.run(debug=True)
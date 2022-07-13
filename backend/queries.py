CREATE_TABLE_Q = """ CREATE TABLE %s (
            id SERIAL PRIMARY KEY,
            tweet_id TEXT,
            uname TEXT,
            name TEXT,
            profile_pic_url TEXT,
            full_text TEXT,
            image1_url TEXT,
            image2_url TEXT,
            image3_url TEXT,
            image4_url TEXT,
            vid_url TEXT,
            vid_prev_url TEXT,
            quote_uname TEXT,
            quote_name TEXT,
            quote_profile_pic_url TEXT,
            quote_tweet_text TEXT,
            retweeted_by_uname TEXT,
            retweeted_by_name TEXT,
            likes INT,
            retweets INT,
            created_at TEXT,
            lang TEXT,
            x INT,
            y INT
        );"""

INSERT_Q = """ INSERT INTO {} (tweet_id, uname, name, profile_pic_url, full_text, image1_url, image2_url,
    image3_url, image4_url, vid_url, vid_prev_url, quote_uname, quote_name, quote_profile_pic_url,
    quote_tweet_text, retweeted_by_uname, retweeted_by_name, likes, retweets, created_at, lang, x, y)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);"""
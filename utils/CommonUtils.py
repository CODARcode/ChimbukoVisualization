import time
import datetime
import inspect

def log(*msg):
    print('[%s] %s: %s' %('{0:%Y-%m-%d %H:%M:%S}'.format(datetime.datetime.now()), inspect.stack()[1][3], " ".join(list(map(str,msg)))))
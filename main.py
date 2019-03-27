from web import web_app
import sys

if len(sys.argv) == 2:
    try:
        log = open(sys.argv[1], 'w')
        sys.stdout = sys.stderr = log
    except IOError:
        pass

port = 5000 # replace 5000 with your preference
web_app.run(host='0.0.0.0', port=port, threaded=True, use_reloader=False)
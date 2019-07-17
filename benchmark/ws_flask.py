from flask import Flask, request, json
from data_handler import RandomMessage

# Flask web application
app = Flask(__name__)
# pseudo-message handler
test_message = RandomMessage()

def shutdown_server():
    func = request.environ.get('werkzeug.server.shutdown')
    if func is None:
        raise RuntimeError('Not running with the Werkzeug Server')
    func()

@app.route('/shutdown', methods = ['POST'])
def shutdown():
    test_message.add_message(None)
    shutdown_server()
    return 'Server shutting down...'

@app.route('/messages', methods = ['POST'])
def api_message():
    if request.headers['Content-Type'] == 'application/json':
        return "JSON Message: " + json.dumps(request.json)
    if request.headers['Content-Type'] == 'application/octet-stream':
        # --- critical section
        # data (reference?) copied (passed) to thread pool for checking
        # below is an example, (maybe add approximated processing time??)
        test_message.add_message(request.data)
        #binary = request.data
        #test_message.is_equal(binary)
        #print("is equal binary: ", test_message.is_equal(binary))
        # --- end of critical section
        return "Binary message received"
    else:
        return "415 Unsupported Media Type"

@app.route('/')
def api_root():
    return 'Welcome'


if __name__ == '__main__':
    import sys

    # arg 1: url (e.g. http://0.0.0.0:5000)
    # arg 2: message size in bytes
    # arg 3: filename with full path
    host = '0.0.0.0'
    port = 5000
    msg_size = 1024 * 1024
    filename = 'message.bin'
    if len(sys.argv) > 1:
        url = sys.argv[1]
        msg_size = int(sys.argv[2])
        filename = sys.argv[3]
        
        if url.startswith('http'):
            url = url.split('//')[1]
        host = url[:-5]
        port = int(url[-4:])
        
    test_message.generate(msg_size, filename)

    # to hide flask output
    stdout = sys.stdout
    stderr = sys.stderr
    sys.stdout = sys.stderr = open('log.txt', 'wt')

    try:
        app.run(host=host, port=port)
    finally:
        test_message.join()

        sys.stdout = stdout
        sys.stderr = stderr
        test_message.show_statistics()


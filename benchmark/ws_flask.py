from flask import Flask, request, json

# for random message generation (will move to utils.py)
import struct
import random

class RandomMessage(object):
    def __init__(self):
        self.filename = None
        # message size (default 1 MBytes)
        self.size = 1024 * 1024
        # the number of integer elements in a message
        self.count = int(self.size / 4)

        self.data = None
        self.binary = None

        self.generate()

    def generate(self, size = None, filename = None):
        if size is None: size = self.size
        self.filename = filename

        self.size = size - size%4
        self.count = int(self.size/4)

        self.data = [random.randint(1, 99999) for _ in range(self.count)]
        self.binary = struct.pack('{:d}i'.format(self.count), *self.data)

        self.save()

    def save(self):
        if self.filename is None: return
        if self.binary is None: return
        with open(self.filename, 'wb') as f:
            f.write(self.binary)

    def load(self):
        if self.filename is None: return
        with open(self.filename, 'rb') as f:
            self.binary = f.read()
            self.data = list(struct.unpack('{:d}i'.format(self.count), self.binary))

    def is_equal(self, binary):
        return self.binary == binary
# end of random message generation

app = Flask(__name__)

# todo: create task queue with single thread?
test_message = RandomMessage()

@app.route('/messages', methods = ['POST'])
def api_message():
    if request.headers['Content-Type'] == 'application/json':
        return "JSON Message: " + json.dumps(request.json)
    if request.headers['Content-Type'] == 'application/octet-stream':
        # --- critical section
        # data (reference?) copied (passed) to thread pool for checking
        # below is an example, (maybe add approximated processing time??)
        binary = request.data
        test_message.is_equal(binary)
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

    # arg 1: message size in bytes
    # arg 2: filename with full path
    msg_size = int(sys.argv[1])
    filename = sys.argv[2]
    test_message.generate(msg_size, filename)

    # to hide flask output
    #sys.stdout = sys.stderr = open('log.txt', 'wt')

    app.run()

    # after that, check the correctnesss


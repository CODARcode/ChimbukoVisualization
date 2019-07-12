from flask import Flask, request, json

# for random message generation (will move to utils.py)
import struct
import random
import threading
import time
from queue import Queue

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

        # thread to process pseudo message
        self.q = Queue()
        self.terminate_event = threading.Event()
        self.thread = threading.Thread(target=self._run)
        self.thread.start()

        # statistics
        self.total_message = 0
        self.min_start_time = None
        self.max_end_time = None
        self.acc_process_time = 0
        self.status = True

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

    def add_message(self, binary):
        """This function will be accessed by multiple threads"""
        self.q.put([time.time(), binary])

    def _run(self):
        while not self.terminate_event.isSet():
            start_time, binary = self.q.get()

            if binary is None:
                break

            # update statistics
            end_time = time.time()
            self.status = self.status and self.is_equal(binary)
            self.total_message = self.total_message + 1

            self.min_start_time = min(self.min_start_time, start_time) \
                if self.min_start_time is not None else start_time

            self.max_end_time = max(self.max_end_time, end_time) \
                if self.max_end_time is not None else end_time

            elapsed = end_time - start_time
            self.acc_process_time = self.acc_process_time + elapsed

            self.q.task_done()

    def join(self):
        if not self.thread.is_alive():
            return

        self.q.join() # block until all tasks are done in the queue
        self.terminate_event.set()
        self.thread.join()

    def show_statistics(self):
        print("=================================================")
        print("Status                : {}".format("PASSED" if self.status else "FAILED"))
        print("Total message received: {}".format(self.total_message))
        if self.total_message:
            print("Min. start time       : {:.3f} sec".format(self.min_start_time))
            print("Max. end time         : {:.3f} sec".format(self.max_end_time))
            print("Acc. process time     : {:.3f} sec".format(self.acc_process_time))
            print("Total elapsed time    : {:.3f} sec".format(self.max_end_time - self.min_start_time))
            print("Avg. process time     : {:.3f} sec".format(self.acc_process_time/self.total_message))
            print("Throughput            : {:.3f} MBytes/sec".format(
                self.total_message*self.size/1024/1024/(self.max_end_time - self.min_start_time)
            ))
            print("Throughput            : {:.3f} Messages/sec".format(
                self.total_message/(self.max_end_time - self.min_start_time)
            ))
        print("=================================================")

# end of random message generation

app = Flask(__name__)

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

    # arg 1: message size in bytes
    # arg 2: filename with full path
    msg_size = 1024 * 1024
    filename = None
    if len(sys.argv) > 1:
        msg_size = int(sys.argv[1])
        filename = sys.argv[2]
    test_message.generate(msg_size, filename)

    # to hide flask output
    stdout = sys.stdout
    stderr = sys.stderr
    sys.stdout = sys.stderr = open('log.txt', 'wt')

    try:
        app.run()
    finally:
        #print("finalize")
        test_message.join()

        sys.stdout = stdout
        sys.stderr = stderr
        test_message.show_statistics()


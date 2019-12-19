from utils.CommonUtils import log
import time

class LogManager:
    """
    Class that records targeted event time
    """
    def __init__(self):
        self.reset()

    def reset(self):
        self.start = -1
        self.total_computing_time = -1
        self.response_time = []
        self.receive_time = {}
        self.push_time = {}

    def is_set(self):
        return True if self.start > -1 else False

    def start_recording(self, time):
        self.start = time

    def pin_recording(self, time):
        if self.is_set():
            self.total_computing_time = time-self.start
            log('RECEIVE TIME:', self.receive_time )
            log('PUSH TIME:', self.push_time )
            log('ACCUM. COMPUTING DURATION:', self.total_computing_time )
        else:
            log('Starting point was not set.')

    def add_response_time(self, time):
        self.response_time.append(time)

    def get_avg_response_time(self):
        ret = len(self.response_time)
        if ret>0:
            avg = sum(self.response_time)/ret
            log('AVG RESPONSE TIME:', avg)
            return avg
        else:
            return ret

    def add_receive_time(self, t):
        t = time.strftime("%H:%M:%S", time.localtime(int(t))) 
        if t not in self.receive_time:
            self.receive_time[t] = 1
        else:
            self.receive_time[t] = self.receive_time[t] + 1

    def add_push_time(self, t):
        t = time.strftime("%H:%M:%S", time.localtime(int(t))) 
        if t not in self.push_time:
            self.push_time[t] = 1
        else:
            self.push_time[t] = self.push_time[t] + 1


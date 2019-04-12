from utils.CommonUtils import log

class LogManager:
    
    def __init__(self):
        self.reset()

    def reset(self):
        self.start = -1
        self.total_computing_time = -1
        self.res_list = []

    def is_set(self):
        return True if self.start > -1 else False

    def start_recording(self, time):
        self.start = time

    def pin_recording(self, time):
        if self.is_set():
            self.total_computing_time = time-self.start
            log('ACCUM. COMPUTING DURATION:', self.total_computing_time )
        else:
            log('Starting point was not set.')

    def add_response_time(self, time):
        self.res_list.append(time)

    def get_avg_response_time(self):
        ret = len(self.res_list)
        if ret>0:
            avg = sum(self.res_list)/ret
            log('AVG RESPONSE TIME:', avg)
            return avg
        else:
            return ret



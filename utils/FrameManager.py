from queue import Queue
from threading import Thread, Event

class FrameManager:
    
    def __init__(self, callback):
        self.callback = callback
        self.queue = Queue(maxsize=1000) # maxsize 
        self.event = Event()
        self.interval = 1
        self.fetcher_daemon = Thread(target=self.dequeue, args=())
        self.fetcher_daemon.daemon = True
        self.fetcher_daemon.start() 

    def dequeue(self):
         while not self.event.isSet():
            if self.queue.empty():
                self.event.wait(self.interval)
            else:
                frame = self.queue.get()
                self.callback(frame)
                
    def enqueue(self, frame):
        self.queue.put(frame)

from queue import Queue
from threading import Thread, Event

class BufferManager:
    
    def __init__(self, callback):
        
        self.callback = callback
        self.queue = Queue(maxsize=1000) # maxsize 
        self.event = Event()
        self.interval = 0.5

        self.fetcher = Thread(target=self._fetch, args=())
        self.fetcher.daemon = True
        self.fetcher.start() 

    def _fetch(self):
         while not self.event.isSet():
            if self.queue.empty():
                self.event.wait(self.interval)
            else:
                frame = self.fetch()
                self.callback(frame)

    def fetch(self):
        return self.queue.get()

    def add(self, frame):
        self.queue.put(frame)

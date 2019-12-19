from queue import Queue
from threading import Thread, Event
from utils.CommonUtils import log

class BufferManager:
    
    def __init__(self, callback):
        """
        Initializes BufferManager
        """
        self.callback = callback # functions that process data, which is given by invoker DataManager
        self.queue = Queue(maxsize=1000) # Initialize Queue 
        self.event = Event() # enables communications among threads 
        self.interval = 0.5 # wait interval

        self.fetcher = Thread(target=self._fetch, args=()) # keeps fetching its element and invokes callback function
        self.fetcher.daemon = True # option for background running
        self.fetcher.start() # starts fetcher thread.

    def _fetch(self):
        """
        Fetches data from the Queue and invoke callback function
        """
        while not self.event.isSet():
            if self.queue.empty():
                self.event.wait(self.interval) # if queue is empty, wait watching for a while
            else:
                frame = self.fetch() # if queue is available, fetch and invoke.
                self.callback(frame)

    def fetch(self):
        """
        Fetches data from the Queue
        """
        return self.queue.get()

    def add(self, frame):
        """
        Add data to the Queue
        """
        self.queue.put(frame)

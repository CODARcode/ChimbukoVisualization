from utils.CommonUtils import log
import numpy as np
import time

class OnlineStatManager:
    """
        Welford's algorithm is used on number of anomalies among ranks
    """
    def __init__(self, ddof=1):
        self.ddof = ddof # Delta Degrees of Freedom
        self.count = 0 
        self.mean = 0.0
        self.M2 = 0.0

    def compute(self, data):
        log('Updating Online GRA Stat ...')
        log(data.items())
        for rank, num in data.items():
            self._compute(num)

    def _compute(self, d):
        self.count += 1
        delta = d - self.mean
        self.mean += delta / self.count
        delta2 = d - self.mean
        self.M2 += delta * delta2

    def get_variance(self):
        return self.M2 / (self.count - self.ddof)

    def get_mean(self):
        return self.mean
    
    def get_std(self):
        return np.sqrt(self.get_variance())

    def get_lower_bound(self):
        return self.get_mean()-(3*self.get_std())

    def get_upper_bound(self):
        # return self.get_mean()+(3*self.get_std())
        return self.get_mean()+(1*self.get_std())


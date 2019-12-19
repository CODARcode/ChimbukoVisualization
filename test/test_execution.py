import sys
sys.path.insert(0, '../')

import time
import json
import glob
import unittest
from module.DataManager import DataManager

DATA_PATH_AGGR = "./data/aggregated/executions/" 

class TestExecution(unittest.TestCase):
    
    def test_add_to_buffer(self):
        """ 
        Test frames are correctly added to the buffer
        """
        dm = DataManager()
        dm.reset()

        frames = glob.glob(DATA_PATH_AGGR+"trace.*.json")
        frames.sort(key=lambda x: int(x.split('.')[-2]))
    
        for i in range(len(frames)):
            data = []
            with open(frames[i], 'r') as f:
                data = json.load(f)
            dm.add_to_buffer(data)
        
        ans = len(frames)
        self.assertEqual(dm.buffer_manager.queue.qsize(), ans)
 
if __name__ == '__main__':
    unittest.main()
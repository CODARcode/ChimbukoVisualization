import sys
sys.path.insert(0,'../web/')

import time
import json
import glob
import unittest
import data_manager as dm

test_data = "./data/aggregated/events/" 

func = []
with open(test_data+"function.json", 'r') as f:
    func = json.load(f)

et = []
with open(test_data+"et.json", 'r') as f:
    et = json.load(f)

class TestEvent(unittest.TestCase):
   
    def prep_data(self, d):
        d.reset()

    def test_add_events(self):
        """
        Check if events trace data is correctly parsed.
        """
        d = dm.Data()
        self.prep_data(d);

        event_list = glob.glob(test_data+"trace.*.json")
        event_list.sort(key=lambda x: int(x.split('.')[-2]))
    
        for i in range(len(event_list)):
            trace = []
            with open(event_list[i], 'r') as f:
                trace = json.load(f)['value']
            d.set_event_types(et)
            d.set_functions(func)
            d.set_FOI(trace['foi'])
            d.set_labels(trace['labels'])
            d.add_events(trace['events'])
        
        ans = {
            0.0: 216175,
            1.0: 177367
        }
        for rank, ev in d.events.items():
            # print(rank, len(ev))
            self.assertEqual(len(ev), ans[rank])
    
    def test_num_anomaly(self):
        """
        Check if anomalies are correctly parsed.
        """
        d = dm.Data()
        self.prep_data(d);

        event_list = glob.glob(test_data+"trace.*.json")
        event_list.sort(key=lambda x: int(x.split('.')[-2]))
    
        for i in range(len(event_list)):
            trace = []
            with open(event_list[i], 'r') as f:
                trace = json.load(f)['value']
            d.set_event_types(et)
            d.set_functions(func)
            d.set_FOI(trace['foi'])
            d.set_labels(trace['labels'])
            d.add_events(trace['events'])
        
        ans = 299
        self.assertEqual(d.anomaly_cnt, ans)
 
if __name__ == '__main__':
    unittest.main()
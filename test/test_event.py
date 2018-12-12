import sys
sys.path.insert(0,'../web/')

import time
import json
import glob
import data_manager as dm
import unittest

test_data = "./data/2x2x2/2cores/" 
test_data_broken = "./data/2x2x2/2cores/broken/" 

def prep_data(d):
    et = []
    fun_names = []
    with open(test_data+"function.json", 'r') as f:
        fun_names = json.load(f)
    with open(test_data+"et.json", 'r') as f:
        et = json.load(f)
    
    d.reset()
    d.set_event_types(et)
    d.set_functions(fun_names)

class TestEvent(unittest.TestCase):
    
    def test_add_events(self):
        """
        Test that the new events are correctly parsed.
        """
        d = dm.Data()
        prep_data(d);

        event_list = glob.glob(test_data+"trace.*.json")
        event_list.sort(key=lambda x: int(x.split('.')[-2]))
    
        for i in range(len(event_list)):
            info = []
            with open(event_list[i], 'r') as f:
                info = json.load(f)
            d.set_FOI(info['value']['foi'])
            d.set_labels(info['value']['labels'])
            d.add_events(info['value']['events'])
        
        i=0
        ans = [177367, 216175]

        for k in d.events.keys():
            self.assertEqual(len(d.events[k]), ans[i])
            i += 1

        
    def test_add_events_broken(self):
        """
        Test that the broken events are safely detected.
        """
        d = dm.Data()
        prep_data(d);

        event_list = glob.glob(test_data_broken+"trace.*.json")
        event_list.sort(key=lambda x: int(x.split('.')[-2]))
    
        for i in range(len(event_list)):
            info = []
            with open(event_list[i], 'r') as f:
                info = json.load(f)
            d.set_FOI(info['value']['foi'])
            d.set_labels(info['value']['labels'])
            self.assertRaises(Exception, d.add_events, info['value']['events'])
            break
           
 
if __name__ == '__main__':
    unittest.main()
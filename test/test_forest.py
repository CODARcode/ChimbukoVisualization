import sys
sys.path.insert(0,'../web/')

import time
import json
import glob
import data_manager as dm
import unittest

test_data = "./data/2x2x2/2cores/" 

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

class TestForest(unittest.TestCase):
    
    def test_generate_forest(self):
        """
        Test that the forest are correctly generated.
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
            d.generate_forest()

        self.assertEqual(len(d.forest), 6820)

    def test_generate_forest_after_cleaned(self):
        """
        Test that the forest is not generated safely.
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
            
        d.generate_forest()
        self.assertEqual(len(d.forest), 0)

 
if __name__ == '__main__':
    unittest.main()
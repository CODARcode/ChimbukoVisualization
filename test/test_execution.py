import sys
sys.path.insert(0, '../')

import time
import json
import glob
import unittest
import threading
from web import data_manager as dm

NUM_RANK = 8
DATA_PATH_AGGR = "./data/aggregated/executions/" 
DATA_PATH_RANK = "./data/per_rank/" 
global_data = {} # global

def check_data():
    cnt = 0
    for rank, data in global_data.items():
        cnt += len(data)
    if cnt == 0:
        return False
    else: 
        return True

def send_data(rank, data):
    try:
        while len(global_data[rank])>0:
            d = global_data[rank].pop(0)
            print(threading.current_thread().getName(), ': adding ', len(d['executions']), 'executions')
            data.set_statistics(d['stat'])
            data.add_executions(d['executions'])
    except:
        print(threading.current_thread().getName(), ': error occured')

class TestExecution(unittest.TestCase):
    
    def prep_data(self, d):
        d.reset()

    def test_add_executions(self):
        """
        Test that the forest are correctly generated.
        """
        d = dm.Data()
        self.prep_data(d);

        event_list = glob.glob(DATA_PATH_AGGR+"trace.*.json")
        event_list.sort(key=lambda x: int(x.split('.')[-2]))
    
        for i in range(len(event_list)):
            data = []
            with open(event_list[i], 'r') as f:
                data = json.load(f)
            d.set_statistics(data['stat'])
            d.add_executions(data['executions'])
        ans = 1059
        self.assertEqual(len(d.executions.keys()), ans)

    def test_add_executions_by_rank(self):
        """
        Test that the forest is not generated safely.
        """
        d = dm.Data()
        self.prep_data(d);

        event_list = glob.glob(DATA_PATH_RANK+"trace.*.json")
        event_list.sort(key=lambda x: int(x.split('.')[-2]))
        
        for i in range(NUM_RANK):
            path_list = glob.glob(DATA_PATH_RANK+'rank.'+str(i)+'.execution.*.json')
            path_list.sort(key=lambda x: int(x.split('.')[-2]))
            for path in path_list:
                with open(path, 'r') as f:
                    if i not in global_data:
                        global_data[i] = []
                    global_data[i].append(json.load(f))
        try:
            threads = []
            for i in range(NUM_RANK):
                # _thread.start_new_thread(send_data, ('tid-'+str(i), i, d) )
                t = threading.Thread(target=send_data, args=(i, d))
                threads.append(t)
                t.start()
        except:
            print ('Error: unable to start thread')
        while check_data():
            pass

        print('Simulation Done', len(d.executions))
        
        for thread in threads:
            thread.join()
        
        self.assertEqual(len(d.executions), 2118)
 
if __name__ == '__main__':
    unittest.main()
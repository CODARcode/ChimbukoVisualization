import requests
import time
import json
import glob
import _thread
import time

AD_SEND_TYPE = 'per_rank' # aggregated or per_rank
DATA_TYPE = 'executions' # events or executions
DATA_PATH = '../data/per_rank/'
VIS_URL = 'http://0.0.0.0:5000/'
NUM_RANK = 8

# initialize server
requests.post(VIS_URL, json={'type':'reset'})

def check_data():
	cnt = 0
	for rank, data in global_data.items():
		cnt += len(data)
	if cnt == 0:
		return False
	else: 
		return True

def send_data(tname, rank):
    try:
        while len(global_data[rank])>0:
            d = global_data[rank].pop(0)
            res = requests.post(VIS_URL+DATA_TYPE, json=d)
            print('['+tname+']', res.json())
    except:
        print('Thread Error')

global_data = {} # global
if AD_SEND_TYPE == 'per_rank':

	# load data
	for i in range(NUM_RANK):
		path_list = glob.glob(DATA_PATH+'rank.'+str(i)+'.execution.*.json')
		path_list.sort(key=lambda x: int(x.split('.')[-2]))
		for path in path_list:
			with open(path, 'r') as f:
				if i not in global_data:
					global_data[i] = []
				global_data[i].append(json.load(f))
	try:
		for i in range(NUM_RANK):
			_thread.start_new_thread(send_data, ('tid-'+str(i), i) )
	except:
		print ('Error: unable to start thread')
	while check_data():
		pass

	print('Simulation Done')

else:
	path_list = glob.glob(DATA_PATH+'trace.*.json')
	path_list.sort(key=lambda x: int(x.split('.')[-2]))
	num_data = 0
	start = time.time()
	for i in range(len(path_list)):
		data = []
		with open(path_list[i], 'r') as f:
			data = json.load(f)
		res = requests.post(VIS_URL+DATA_TYPE, json=data)
		print(res.json())
		if DATA_TYPE == 'events':
			num_data += len(data['value']['events'])
		else:
			num_data += len(data['executions'])

	# summary
	duration = time.time()-start
	print('----------------------------------------------------------------')
	print('Duration:', duration, 'sec, ', '# events (or executions) :', num_data, ', data/s: ', num_data/duration)

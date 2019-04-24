import requests
import time
import json
import glob
import time
from threading import Thread, current_thread
import sys
import os

AD_SEND_TYPE = 'MULTI_STREAM' # AGGREGATED or MULTI_STREAM
DATA_TYPE = 'EXECUTIONS' # EVENTS or EXECUTIONS
DATA_PATH = '../../data/sc19/' #  ../../data/rank_200/   ../../data/per_rank/ # ../../data/nwchem_executions_rank/ # ../../data/nwchem_events_rank/ # ../../data/aggregated/executions/ # ../../data/sc19/
VIS_URL = 'http://0.0.0.0:5000/'
TRACE_FRAME_LIMIT = 500
NUM_RANK = 20

def check_data():
	cnt = 0
	for rank, data in global_data.items():
		cnt += len(data)
	if cnt == 0:
		return False
	else: 
		return True

thread_res_time = {}
def send_data(rank):
	try:
		cnt = 0
		global_time = 0
		tot = len(global_data[rank])
		# while len(global_data[rank])>0:
		for cnt in range(TRACE_FRAME_LIMIT):
			
				d = global_data[rank].pop(0)
				start = time.time()
				res = requests.post(VIS_URL+DATA_TYPE.lower(), json=d)
				global_time += (time.time()-start)
				print('['+current_thread().name+'] sent', cnt,'out of', tot, 'data', res.json())
				cnt += 1
			# time.sleep(1)
		thread_res_time[current_thread().name] = global_time/cnt
		print('['+current_thread().name+'] avg response time:', thread_res_time[current_thread().name] )
	except:
		print('Thread Error')

def send_data_frame(rank, frame):
	# try:
	fname = DATA_PATH+'dump-'+get_str_digit(3, rank)+'/trace.'+get_str_digit(6, frame)+'.'+get_str_digit(3, rank)+'.json'
	if fname in global_data_frame[rank]:
		f = global_data_frame[rank][fname]
		res = requests.post(VIS_URL+DATA_TYPE.lower(), json=f)
		print('['+current_thread().name+'] sent (frame:', frame, 'rank:', rank,')')
	else:
		print('['+current_thread().name+'] not found (frame:', frame, 'rank:', rank,')')
	# except Error:
	# 	print('Thread Error', Error)

global_data = {} # global
def send_multiple_stream_by_rank():
	# initialize server
	requests.post(VIS_URL, json={'type':'reset'})
	num_data = 0
	for i in range(NUM_RANK):
		# path_list = glob.glob(DATA_PATH+'rank.'+str(i)+'.trace.*.json')
		# path_list.sort(key=lambda x: int(x.split('.')[-2]))
		path_list = glob.glob(DATA_PATH+'dump-'+get_str_digit(3, i)+'/trace.*.*.json')
		path_list.sort(key=lambda x: int(x.split('.')[-3]))
		for path in path_list:
			with open(path, 'r') as f:
				if i not in global_data:
					global_data[i] = []
				data = json.load(f)	
				if DATA_TYPE == 'EXECUTIONS':
					num_data += len(data['executions'])
				elif DATA_TYPE == 'EVENTS': # events		
					num_data += len(data['value']['events'])
				global_data[i].append(data)
	try:
		threads = []
		for i in range(NUM_RANK):
			thrd = Thread(target=send_data, args=[i,])
			threads.append(thrd)
		start = time.time()
		for thrd in threads:
			thrd.start() 
		while check_data():
			time.sleep(0.1)
		tot_res = time.time()-start
		for thrd in threads:
			thrd.join()
	except:
		print ('Threading Error')
	sum_res = 0
	for k, v in thread_res_time.items():
		sum_res += v
	print('Done')
	print('----------------------------------------------------------------')
	print('# RANKS: %d # %s: %d, AVG. RESPONSE: %f, TOTAL RESPONSE: %d, AVG. PROCESS: %f' %(NUM_RANK, DATA_TYPE, num_data, sum_res/len(thread_res_time.keys()), tot_res, num_data/tot_res) )

global_data_frame = {} # global
def send_multiple_stream_by_rank_frame():
	# initialize server
	requests.post(VIS_URL, json={'type':'reset'})
	num_data = 0
	for i in range(NUM_RANK):
		# path_list = glob.glob(DATA_PATH+'rank.'+str(i)+'.trace.*.json')
		# path_list.sort(key=lambda x: int(x.split('.')[-2]))
		path_list = glob.glob(DATA_PATH+'dump-'+get_str_digit(3, i)+'/trace.*.*.json')
		path_list.sort(key=lambda x: int(x.split('.')[-3]))
		for path in path_list:
			with open(path, 'r') as f:
				if i not in global_data_frame:
					global_data_frame[i] = {}
				data = json.load(f)	
				if DATA_TYPE == 'EXECUTIONS':
					num_data += len(data['executions'])
				elif DATA_TYPE == 'EVENTS': # events		
					num_data += len(data['value']['events'])
				global_data_frame[i][path] = data
		
	try:
		for frame_no in range(TRACE_FRAME_LIMIT):
			threads = []
			for rank_no in range(NUM_RANK):
				thrd = Thread(target=send_data_frame, args=[rank_no, frame_no])
				threads.append(thrd)
			for thrd in threads:
				thrd.start() 
			for thrd in threads:
				thrd.join()
	except:
		print ('Threading Error')
	print('Done')
	
def get_str_digit(n, digit):
	digit_str = str(digit)
	while len(digit_str) <n:
		digit_str = '0'+digit_str 
	return digit_str

def send_aggregated_data():
	
	# initialize server
	requests.post(VIS_URL, json={'type':'reset'})
	
	path_list = glob.glob(DATA_PATH+'trace.*.json')
	path_list.sort(key=lambda x: int(x.split('.')[-2]))
	
	num_data = 0
	global_time = 0
	for i in range(len(path_list)):
		if i < TRACE_FRAME_LIMIT:
			data = []
			with open(path_list[i], 'r') as f:
				data = json.load(f)
			start = time.time()	
			res = requests.post(VIS_URL+DATA_TYPE.lower(), json=data)
			global_time += (time.time()-start)
			print(res.json())
			if DATA_TYPE == 'EVENTS':
				num_data += len(data['value']['events'])
			else:
				num_data += len(data['executions'])

	# summary
	print('Done')
	print('----------------------------------------------------------------')
	print('# %s: %d, AVG. RESPONSE: %f, TOTAL RESPONSE: %d, AVG. PROCESS: %f' %(DATA_TYPE, num_data, global_time/len(path_list), global_time, num_data/global_time) )

def get_data_size():
	size_map = {}
	accum_size = 0
	for i in range(NUM_RANK):
		path_list = glob.glob(DATA_PATH+'dump-'+get_str_digit(3, i)+'/trace.*.*.json')
		path_list.sort(key=lambda x: int(x.split('.')[-3]))
		for path in path_list:
			with open(path, 'r') as f:
				accum_size = accum_size + os.path.getsize(path)
		if i in [0, 9, 19, 29, 39, 49, 59, 69, 79, 89, 99]:
			size_map[i] = accum_size
	print('size:', size_map)

if __name__ == "__main__":

	if len(sys.argv) == 2:
		try:
			log = open(sys.argv[1], 'w')
			sys.stdout = sys.stderr = log
		except IOError:
			pass
	
	if AD_SEND_TYPE == 'MULTI_STREAM':
		send_multiple_stream_by_rank_frame()
		# get_data_size()
	elif AD_SEND_TYPE == 'AGGREGATED':
		send_aggregated_data()
	

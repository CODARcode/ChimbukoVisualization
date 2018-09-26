import requests
import time
import json

vis_url = 'http://127.0.0.1:5000/events'

#----set function dictionary----
fun_names = []
with open("../data/StreamingNWChem/function.json", 'r') as f:
	fun_names = json.load(f)

# fun_names = [ w.replace("b'", "").replace("'", "") for w in fun_names.values()]

requests.post(vis_url, json={'type':'functions', 'value':fun_names})
#----set function of interest----
#requests.post(vis_url, json={'type':'foi','value':'void LAMMPS_NS::PairEAM::compute(int, int) [{pair_eam.cpp} {134,1}-{315,1}]'})
requests.post(vis_url, json={'type':'foi','value':['adios_close', 'adios_open']})
#----set event types, they are not fixed----
requests.post(vis_url, json={'type':'event_types', 'value':['ENTRY', 'EXIT', 'SEND', 'RECV']})
#requests.post(vis_url, json={'type':'event_types', 'value':['EXIT', 'ENTRY', 'SEND', 'RECV']})
#----clean previous events----
requests.post(vis_url, json={'type':'reset'})

#----simulating update----
import glob

event_list = glob.glob("../data/StreamingNWChem/trace.*.json")
event_list.sort()

anomaly_list = glob.glob("../data/StreamingNWChem/anomaly.*.json")
anomaly_list.sort()

# foi_list = glob.glob("../data/StreamingNWChem/foi.*.json")
# foi_list.sort()

for i in range(len(event_list)):
	
	# with open(foi_list[i], 'r') as f:
	# 	foi = json.load(f)
	# print("send ", len(foi)," foi data")
	# requests.post(vis_url, json={'type':'foi', 'value':foi})
	# time.sleep(0.1)
	
	labels = []
	with open(anomaly_list[i], 'r') as f:
		labels = json.load(f)
	print("send ", len(labels)," anomaly data")
	requests.post(vis_url, json={'type':'labels', 'value':labels})
	time.sleep(0.1)

	all_events = []
	with open(event_list[i], 'r') as f:
		all_events = json.load(f)

	# send events data
	print("send ", len(all_events)," events data")
	res = requests.post(vis_url, json={'type':'events','value':all_events})
	print(res.json())
	time.sleep(1)
	

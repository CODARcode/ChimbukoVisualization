import requests
import time
import json

vis_url = 'http://127.0.0.1:5000/events'

#----set function dictionary----
fun_names = []
with open("../data/functions_lammps_ref.json", 'r') as f:
	fun_names = json.load(f)
requests.post(vis_url, json={'type':'functions', 'value':fun_names})
#----set function of interest----
requests.post(vis_url, json={'type':'foi','value':'void LAMMPS_NS::PairEAM::compute(int, int) [{pair_eam.cpp} {134,1}-{315,1}]'})
#requests.post(vis_url, json={'type':'foi','value':'MPI_Allgather()'})
#----clean previous events----
requests.post(vis_url, json={'type':'reset'})
#----simulating update----
all_events = []
datafile = "../data/event_list.json"
with open(datafile, 'r') as f:
	all_events = json.load(f)
step = 500
start = 0

while start < len(all_events):
	print("send events data")
	#send events data
	res = requests.post(vis_url, json={'type':'events','value':all_events[start:start+step]})
	start += step
	print(res.json())
	time.sleep(0.1)

# print("send events data")
# res = requests.post(vis_url, json={'type':'events','value':all_events})
# print(res.json())
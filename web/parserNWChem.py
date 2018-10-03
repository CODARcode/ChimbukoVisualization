import requests
import time
import json

vis_url = 'http://127.0.0.1:5000/events'
vis_data = "../data/StreamingNWChem/"

#----set function dictionary----
fun_names = []
with open(vis_data+"function.json", 'r') as f:
	fun_names = json.load(f)
requests.post(vis_url, json={'type':'functions', 'value':fun_names})

#----set function of interest----
foi = []
with open(vis_data+"foi.0.json", 'r') as f:
	foi = json.load(f)
requests.post(vis_url, json={'type':'foi','value':foi})

#----set event types, they are not fixed----
et = []
with open(vis_data+"et.json", 'r') as f:
	et = json.load(f)
print(et)
requests.post(vis_url, json={'type':'event_types','value':et})

#----clean 
# previous events----
requests.post(vis_url, json={'type':'reset'})

#----simulating update----
import glob

event_list = glob.glob(vis_data+"trace.*.json")
event_list.sort()

anomaly_list = glob.glob(vis_data+"anomaly.*.json")
anomaly_list.sort()

for i in range(len(event_list)):
		
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
	

import requests
import time
import json

vis_url = 'http://0.0.0.0:5000/'
vis_data = "../"

res = requests.post(vis_url+'events', json={'type':'reset'})
print(res.json())

#----simulating update----
import glob

execution_list = glob.glob(vis_data+"execution.*.json")
execution_list.sort(key=lambda x: int(x.split('.')[-2]))

foi_list = glob.glob(vis_data+"foi.*.json")
foi_list.sort(key=lambda x: int(x.split('.')[-2]))

execs = 0
dustart = time.time()

restimes = []
start = time.time()
for i in range(len(execution_list)):
	
	executions = []
	with open(execution_list[i], 'r') as f:
		executions = json.load(f)
	foi = []
	with open(foi_list[i], 'r') as f:
		foi = json.load(f)
	
	execs += len(executions)
	print('send', len(executions), 'executions.')
	res = requests.post(vis_url+'executions', json={
		'executions': executions,
		'foi': foi
	})
	end = time.time()
	restimes.append(end-start)
	start = end
	print(res.json())

dur = time.time()-dustart
print('duration:', dur, 'sec, ', '# executions:', execs, ', execs/s: ', execs/dur )

totres = sum(restimes)
print('total responsoe time:', totres, 'avg res/sec:', totres/dur)

# requests.post('http://127.0.0.1:5000/log', json={'type':'log'})


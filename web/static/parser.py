import requests
import time
import json

vis_url = 'http://127.0.0.1:5000/events'

#set function dictionary
requests.post(vis_url, json={'type':'functions',
	'value':['void LAMMPS_NS::Pair::ev_setup(int, int) [{pair.cpp} {753,1}-{814,1}]', 'FLUSH', 'void LAMMPS_NS::CommBrick::forward_comm_pair(LAMMPS_NS::Pair *) [{comm_brick.cpp} {881,1}-{913,1}]', 'int LAMMPS_NS::PairEAM::pack_reverse_comm(int, int, double *) [{pair_eam.cpp} {844,1}-{852,1}]', 'void LAMMPS_NS::PairEAM::unpack_reverse_comm(int, int *, double *) [{pair_eam.cpp} {856,1}-{865,1}]', 'MPI_Send()', 'void LAMMPS_NS::Memory::sfree(void *) [{memory.cpp} {90,1}-{98,1}]', 'void LAMMPS_NS::PairEAM::unpack_forward_comm(int, int, double *) [{pair_eam.cpp} {833,1}-{840,1}]', 'int LAMMPS_NS::PairEAM::pack_forward_comm(int, int *, double *, int, int *) [{pair_eam.cpp} {818,1}-{829,1}]', 'MPI_Wait()', 'void LAMMPS_NS::PairEAM::compute(int, int) [{pair_eam.cpp} {134,1}-{315,1}]', 'void LAMMPS_NS::CommBrick::reverse_comm_pair(LAMMPS_NS::Pair *) [{comm_brick.cpp} {920,1}-{951,1}]', 'void LAMMPS_NS::Pair::ev_tally(int, int, int, int, double, double, double, double, double, double) [{pair.cpp} {841,1}-{935,1}]', 'void LAMMPS_NS::Pair::virial_fdotr_compute() [{pair.cpp} {1482,1}-{1530,1}]', 'MPI_Irecv()', 'void *LAMMPS_NS::Memory::smalloc(LAMMPS_NS::bigint, const char *) [{memory.cpp} {35,1}-{59,1}]']})
#set function of interest
requests.post(vis_url, json={'type':'foi','value':'void LAMMPS_NS::PairEAM::compute(int, int) [{pair_eam.cpp} {134,1}-{315,1}]'})

#simulating update
all_events = []
with open("../data/events_2ranks.json", 'r') as f:
	all_events = json.load(f)
step = 100
start = 0

while start < len(all_events):
	print("send events data")
	#send events data
	res = requests.post(vis_url, json={'type':'events','value':all_events[start:start+step]})
	start += step
	print(res.json())
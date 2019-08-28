class Config(object):
    def __init__(self):
        self.config = {
            'RANK_ID': 'comm ranks',
            'EXECUTION_ID': 'findex',
            'THREAD_ID': 'threads',
            'PARENT_ID': 'parent',
            'PROG_NAME': 'prog names',
            'FUNC_NAME': 'name',
            'ENTRY_TIME': 'entry',
            'EXIT_TIME': 'exit'
        }

    def get(self, name):
        if name in self.config:
            return self.config[name]
        else:
            return None

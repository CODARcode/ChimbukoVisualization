FROM ubuntu:latest
  
RUN mkdir -p /ChimbukoVisualization
RUN apt-get update && apt-get install -y python3 python3-pip git
RUN pip3 install Flask Numpy requests
ADD . /ChimbukoVisualization
WORKDIR /ChimbukoVisualization

CMD ["python3", "/ChimbukoVisualization/main.py"]	

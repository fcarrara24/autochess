# build
docker build -f docker/Dockerfile -t autochess .

# run
docker run -p 3000:3000 autochess:latest
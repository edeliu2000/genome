FROM node:10 as build

WORKDIR /app
COPY . ./
RUN npm install

FROM node:10-alpine

COPY --from=build /app /
CMD ["npm", "start"]

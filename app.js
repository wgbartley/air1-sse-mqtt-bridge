const EventSource = require('eventsource')
const axios = require('axios')
const mqtt = require('mqtt')
require('dotenv').config()
const e = process.env

// Configure the event source and MQTT broker
const sseUrl = e.SSE_SOURCE
const sseTimeout = e.SSE_TIMEOUT
const sseReconnectDelay = e.SSE_RECONNECT_DELAY
const mqttBrokerUrl = e.MQTT_URL // Change this to your MQTT broker URL
const mqttTopic = e.MQTT_TOPIC // Change this to your desired MQTT topic

const mqttOptions = {
	username: e.MQTT_USER, // Replace with your MQTT username
	password: e.MQTT_PASS, // Replace with your MQTT password
};

// Connect to the MQTT broker
const client = mqtt.connect(mqttBrokerUrl, mqttOptions)

let sseTimeoutTimer

client.on('connect', function () {
	console.log('Connected to MQTT broker')
    sseConnect()
})

client.on('error', function (error) {
	console.error('MQTT Client Error:', error)
})

client.on('close', () => {
    console.log('MQTT connection closed.  Attempting to reconnect...')
})

client.on('reconnect', () => {
    console.log('Reconnected to MQTT!')
})


function sseConnect() {
    // Subscribe to the event source
	axios({
        method: 'GET',
        url: sseUrl,
        responseType: 'stream'
    }).then(response => {
        console.log('Connected to SSE')

        response.data.on('data', chunk => {
            clearTimeout(sseTimeoutTimer)

            const textChunk = chunk.toString('utf8')

            const lines = textChunk.split('\n')
            let eventName = ''

            lines.forEach(line => {
                if(line.startsWith('event:')) {
                    eventName = line.replace('event:', '').trim()
                } else if(line.startsWith('data:')) {
                    const eventData = line.replace('data:', '').trim()
                    console.log(`Received event: ${eventName}, Data: ${eventData}`)

                    client.publish(`${mqttTopic}/${eventName}`, eventData, {}, (error) => {
                        if(error)
                            console.error('Publish error:', error)
                    })
                }
            })

            sseTimeoutTimer = setTimeout(() => {
                console.log('SSE timed out.  Attempting to reconnect...')
                response.data.destroy()
                sseConnect()
            }, sseTimeout)
        })


        response.data.on('end', () => {
            console.log('SSE connection closed by server.  Attempting to reconnect...')
            clearTimeout(sseTimeoutTimer)
            setTimeout(sseConnect, sseReconnectDelay)
        })
    }).catch(error => {
        console.error('Error connecting to SSE:', error)
    })


    sseTimeoutTimer = setTimeout(() => {
        console.log('Data timeout.  Attempting to reconnect...')
        response.data.destroy()
        sseConnect()
    }, sseTimeout)
}


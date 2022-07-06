import * as server from './server';
import axios from 'axios';

console.log('Initializing meetbot service...');
console.log('Registering weekly restart...');

axios.post(
	`https://${process.env.BALENA_DEVICE_UUID}.balena-devices.com/createjob`,
	{
		minute: '0 11 * * 1',
		command: `curl -X POST --header "Content-Type:application/json" ${process.env.BALENA_SUPERVISOR_ADDRESS}/v1/reboot?apikey=${process.env.BALENA_SUPERVISOR_API_KEY}`,
	},
);

server.start();

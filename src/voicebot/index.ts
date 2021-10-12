// const puppeteer = require('puppeteer');
import puppeteer from 'puppeteer-extra';
import StealthPlugin = require('puppeteer-extra-plugin-stealth');

import EventEmitter = require('events');
(global as any).eventEmitter = new EventEmitter();

import * as features from './features';

for (const feature of features.all) {
	feature.run('');
}

puppeteer.use(StealthPlugin());

type Options = {
	onEnd: () => void;
};

// TODOs
// * replace every HACK
// * replace all selector queries as they are bound to break

export async function joinMeet(meetURL: string): Promise<void> {
	const { browser, page } = await setup();
	try {
		// await page.goto('https://accounts.google.com/');

		// console.log('typing out email');
		// await page.waitForSelector('input[type="email"]');
		// await page.waitForSelector('#identifierNext');
		// await page.click('input[type="email"]');
		// await page.keyboard.type(login, { delay: 300 });
		// let navigationPromise = page.waitForNavigation();
		// await page.click('#identifierNext');
		// await navigationPromise;
		// await page.waitForTimeout(600); // animations...

		// console.log('typing out password');
		// await page.waitForSelector('input[type="password"]');
		// await page.waitForSelector('#passwordNext');
		// await page.click('input[type="password"]');
		// await page.keyboard.type(password, { delay: 200 });
		// navigationPromise = page.waitForNavigation();
		// await page.click('#passwordNext');
		// await navigationPromise;
		// await page.waitForTimeout(600); // animations...

		// await page.screenshot({ path: 'after-login.png' });

		console.log('going to Meet after signing in');
		await page.goto(meetURL);

		// await page.screenshot({ path: 'meet-loaded.png' });

		await page.keyboard.type('Hubot', { delay: 10 });

		console.log('turn off cam using Ctrl+E');
		await page.waitForTimeout(3000);
		await page.keyboard.down('ControlLeft');
		await page.keyboard.press('KeyE');
		await page.keyboard.up('ControlLeft');
		await page.waitForTimeout(100);

		console.log('turn off mic using Ctrl+D');
		await page.waitForTimeout(1000);
		await page.keyboard.down('ControlLeft');
		await page.keyboard.press('KeyD');
		await page.keyboard.up('ControlLeft');
		await page.waitForTimeout(100);

		await clickText(page, 'Ask to join');

		// either the call is recorded and we need to confirm or we eventually get in
		const confirmOrIn = await page.waitForXPath(
			"//*[contains(text(),'call_end')]|//*[contains(text(),'Join now')]",
		);
		if ((await confirmOrIn?.evaluate((n: any) => n.innerText)) === 'Join now') {
			await clickText(page, 'Join now');
			await page.waitForXPath("//*[contains(text(),'call_end')]");
		}

		await page.waitForTimeout(1500);
		// await page.screenshot({ path: 'after-join.png' });

		console.log('turn on captions');
		(global as any).eventEmitter.emit('joined', { url: meetURL });
		await clickText(page, 'more_vert');
		await page.waitForTimeout(1000);
		await clickText(page, 'Captions');
		await page.waitForTimeout(1000);
		await clickText(page, 'English');
		await page.waitForTimeout(1000);
		await clickText(page, 'Apply');
		await page.waitForTimeout(1000);

		console.log('open people list to activate feature');
		await clickText(page, 'people_outline');
		await page.waitForTimeout(1000);

		console.log('open chat section and send a message to all');
		await clickText(page, 'chat');
		await page.waitForTimeout(1500);
		// await page.screenshot({ path: 'after-chat-open.png' });
		await page.keyboard.type('Hello, good day everyone!', { delay: 10 });
		await page.keyboard.press('Enter');
		// await page.screenshot({ path: 'after-chat.png' });

		console.log('captions are on');
		await page.waitForTimeout(1000);
		// await page.screenshot({ path: 'end.png' });

		console.log('streaming captions');

		// HACK replace with proper command infrastructure
		let sayHelloInProgress = false;
		while (true) {
			await page.waitForTimeout(500);

			const elems = await page.$$('span.CNusmb');
			const texts = await Promise.all(
				elems.map((el) => el.evaluate((node: any) => node.innerText)),
			);
			(global as any).eventEmitter.emit('captions', {
				url: meetURL,
				text: texts[0],
			});
			if (
				texts.find((t) => /say[^a-z]*hello[^a-z]*jarvis/i.test(t)) &&
				!sayHelloInProgress
			) {
				sayHelloInProgress = true;
				await page.keyboard.type('What can I do for you, Sir?', {
					delay: 10,
				});
				await page.keyboard.press('Enter');
			} else {
				sayHelloInProgress = false;
			}

			// names of participants in list
			const participants = await page.$$('span.ZjFb7c');
			(global as any).eventEmitter.emit('participants', {
				url: meetURL,
				participants: participants.length,
			});

			if (participants.length === 1) {
				console.log("nobody else is here - I'm leaving...");
				(global as any).eventEmitter.emit('left', { url: meetURL });
				break;
			}
		}

		await browser.close();
	} catch (err) {
		await page.screenshot({ path: 'exception.png' });
		throw err;
	}
}

export async function start(url: string, opts: Options) {
	await joinMeet(url);
	// TODO make onEnd run when the meet is closed
	setTimeout(opts.onEnd, 3000000);
}

const setup = async () => {
	// https://stackoverflow.com/questions/52464583/possible-to-get-puppeteer-audio-feed-and-or-input-audio-directly-to-puppeteer
	const browser = await puppeteer.launch({
		headless: true,
		args: [
			'--use-fake-ui-for-media-stream',
			'--use-fake-device-for-media-stream',
			'--use-file-for-fake-audio-capture=/home/mj/experiment/meet-the-bots/example.wav',
			'--allow-file-access',
			'--lang=en',
		],
		env: {
			LANG: 'en',
		},
		defaultViewport: { height: 912, width: 1480 },
		ignoreDefaultArgs: ['--mute-audio'],
	});

	const context = await browser.defaultBrowserContext();
	context.overridePermissions('https://meet.google.com/', [
		'microphone',
		'camera',
		'notifications',
	]);

	// maybe we could use something like this to fake login
	// "cookie": "CONSENT=PENDING+954; SMSV=ADHTe-...............
	// context.setCookie ?

	const page = await browser.newPage();
	await page.setExtraHTTPHeaders({
		'Accept-Language': 'en',
		'sec-ch-ua':
			'"Chromium";v="94", "Microsoft Edge";v="94", ";Not A Brand";v="99"',
	});
	// Set the language forcefully on javascript
	await page.evaluateOnNewDocument(() => {
		Object.defineProperty(navigator, 'language', {
			get() {
				return 'en';
			},
		});
		Object.defineProperty(navigator, 'languages', {
			get() {
				return ['en'];
			},
		});
	});
	return { browser, page };
};

const clickText = async (page: any, text: string) => {
	const elems = await page.$x(`//*[contains(text(),'${text}')]`);
	for (const el of elems) {
		try {
			await el.click();
		} catch {
			// sometimes we find stuff with the same text which is not clickable
		}
	}
};
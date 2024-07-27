export default {
	async fetch(request, env, ctx) {
		return handleLoginAndBackup(request, env);
	},
	async scheduled(event, env, ctx) {
		ctx.waitUntil(handleLoginAndBackup(env));
	},
};

async function handleLoginAndBackup(request, env) {
	const loginUrl = env.BASE_URL + '/api/login';
	const backupUrl = env.BASE_URL + '/api/s/default/cmd/backup';

	const loginPayload = JSON.stringify({
		username: env.USERNAME,
		password: env.PASSWORD,
	});

	const loginInit = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: loginPayload,
	};

	try {
		// Login to the API
		const loginResponse = await fetch(loginUrl, loginInit);
		const loginResult = await loginResponse.json();

		if (loginResult.meta && loginResult.meta.rc === 'ok') {
			// Login successful, proceed to trigger backup
			const backupPayload = JSON.stringify({
				days: 0,
				cmd: 'async-backup',
			});

			const backupInit = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Cookie: loginResponse.headers.get('set-cookie'), // Pass the session cookie
				},
				body: backupPayload,
			};

			const backupResponse = await fetch(backupUrl, backupInit);
			const backupResult = await backupResponse.json();

			console.log('Backup trigger response:', backupResult);

			if (backupResult.meta && backupResult.meta.rc === 'ok') {
				// Backup triggered successfully, wait for it to complete and check file size
				const fileUrl = env.BASE_URL + '/dl/backup/8.0.7.unf';
				await waitForBackupFileReady(fileUrl, loginResponse.headers.get('set-cookie'));

				const timestamp = getCurrentTimestamp();
				const filename = `network_backup_${timestamp}_8.0.7.unf`;

				const uploadResponse = await downloadAndUploadToR2(fileUrl, filename, loginResponse.headers.get('set-cookie'), env);
				return uploadResponse;
			} else {
				return new Response('Backup trigger failed.', {
					status: 401,
					headers: { 'Content-Type': 'text/plain' },
				});
			}
		} else {
			console.log('Login failed response:', loginResult);
			return new Response('Login failed.', {
				status: 401,
				headers: { 'Content-Type': 'text/plain' },
			});
		}
	} catch (error) {
		console.log('An error occurred:', error.message);
		return new Response('An error occurred: ' + error.message, {
			status: 500,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
}

async function waitForBackupFileReady(url, cookie, maxAttempts = 3, delayBetweenAttempts = 60000) {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const response = await fetch(url, {
				method: 'HEAD',
				headers: { Cookie: cookie },
			});

			if (response.ok) {
				const contentLength = parseInt(response.headers.get('content-length') || '0');
				console.log(`Attempt ${attempt + 1}: File size is ${contentLength} bytes`);

				if (contentLength > 40000) {
					console.log('Backup file is ready and has the expected size');
					return;
				}
			}
		} catch (error) {
			console.log(`Error checking file: ${error.message}`);
		}

		console.log(`Backup file not ready yet. Waiting... (Attempt ${attempt + 1}/${maxAttempts})`);
		await sleep(delayBetweenAttempts);
	}

	throw new Error('Backup file did not reach the expected size within the allocated time');
}

async function downloadAndUploadToR2(url, key, cookie, env, retries = 3, delay = 5000) {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const response = await fetch(url, {
				headers: { Cookie: cookie },
			});
			if (!response.ok) {
				throw new Error(`Failed to fetch file: ${response.statusText}`);
			}

			// Get the content type from the response headers
			const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

			// Read the response as an ArrayBuffer to preserve binary data
			const arrayBuffer = await response.arrayBuffer();

			console.log(`Attempt ${attempt}: Downloaded file size: ${arrayBuffer.byteLength} bytes`);

			if (arrayBuffer.byteLength > 40000) {
				// Upload the ArrayBuffer directly to Cloudflare R2
				const r2Object = await env.BUCKET_UNIFI_BACKUPS.put(key, arrayBuffer, {
					contentType: contentType,
				});

				return new Response(`Put ${key} successfully! File size: ${arrayBuffer.byteLength} bytes`, {
					status: 200,
					headers: { 'Content-Type': 'text/plain' },
				});
			} else {
				console.log(`Attempt ${attempt}: File size is less than expected (${arrayBuffer.byteLength} bytes), retrying...`);
			}
		} catch (error) {
			console.log(`Attempt ${attempt} failed: ${error.message}`);
		}
		await sleep(delay);
	}
	throw new Error('Failed to upload file after multiple attempts');
}

function getCurrentTimestamp() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	const year = now.getFullYear();
	let hours = now.getHours();
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const ampm = hours >= 12 ? 'PM' : 'AM';
	hours = hours % 12;
	hours = hours ? hours : 12; // the hour '0' should be '12'
	const strTime = `${hours}-${minutes}-${ampm}`;
	return `${month}.${day}.${year}_${strTime}`;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

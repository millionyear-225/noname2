//@ts-nocheck
export default async function browserReady({ lib, game }) {
	lib.path = (await import("path-browserify-esm")).default;

	let hasServer = false;
	try {
		await fetch(`/checkFile?fileName=noname.js`)
			.then(response => response.json())
			.then(result => {
				if (!result?.success) throw new Error(result.errorMsg);
			});
		hasServer = true;
	} catch (e) {
		console.warn("后端文件服务不可用，将使用静态托管兼容模式:", e);
	}

	game.export = function (data, name) {
		if (typeof data === "string") {
			data = new Blob([data], { type: "text/plain" });
		}
		let fileNameToSaveAs = name || "noname";
		fileNameToSaveAs = fileNameToSaveAs.replace(/\\|\/|:|\?|"|\*|<|>|\|/g, "-");

		const downloadLink = document.createElement("a");
		downloadLink.download = fileNameToSaveAs;
		downloadLink.innerHTML = "Download File";
		downloadLink.href = window.URL.createObjectURL(data);
		downloadLink.click();
	};

	game.exit = function () {
		window.onbeforeunload = null;
		window.close();
	};

	game.open = function (url) {
		window.open(url);
	};

	if (hasServer) {
		// 有后端文件服务时，使用原有API实现
		game.checkFile = function checkFile(fileName, callback, onerror) {
			fetch(`/checkFile?fileName=${fileName}`)
				.then(response => response.json())
				.then(result => {
					if (result) {
						if (result.success) {
							switch (result.data) {
								case "file":
									callback?.(1);
									return;
								case "directory":
									callback?.(0);
									return;
								default:
									callback?.(-1);
									return;
							}
						}
					}
					onerror?.(result?.errorMsg);
				})
				.catch(onerror);
		};

		game.checkDir = function checkDir(dir, callback, onerror) {
			fetch(`/checkDir?dir=${dir}`)
				.then(response => response.json())
				.then(result => {
					if (result) {
						if (result.success) {
							switch (result.data) {
								case "file":
									callback?.(0);
									return;
								case "directory":
									callback?.(1);
									return;
								default:
									callback?.(-1);
									return;
							}
						}
					}
					onerror?.(result?.errorMsg);
				})
				.catch(onerror);
		};

		game.readFile = function readFile(fileName, callback = () => {}, error = () => {}) {
			fetch(`/readFile?fileName=${fileName}`)
				.then(response => response.json())
				.then(result => {
					if (result?.success) {
						const data = result.data;
						/** @type {Uint8Array} */
						let buffer;
						if (typeof data == "string") {
							buffer = Uint8Array.fromBase64(data);
						} else if (Array.isArray(data)) {
							buffer = new Uint8Array(data);
						}
						callback(buffer.buffer);
					} else {
						error(result?.errorMsg);
					}
				})
				.catch(error);
		};

		game.readFileAsText = function readFileAsText(fileName, callback = () => {}, error = () => {}) {
			fetch(`/readFileAsText?fileName=${fileName}`)
				.then(response => response.json())
				.then(result => {
					if (result?.success) {
						callback(result.data);
					} else {
						error(result?.errorMsg);
					}
				})
				.catch(error);
		};

		game.writeFile = function writeFile(data, path, name, callback = () => {}) {
			game.ensureDirectory(path, () => {
				if (Object.prototype.toString.call(data) == "[object File]") {
					const fileReader = new FileReader();
					fileReader.onload = event => {
						game.writeFile(event.target.result, path, name, callback);
					};
					fileReader.readAsArrayBuffer(data, "UTF-8");
				} else {
					let filePath = path;
					if (path.endsWith("/")) {
						filePath += name;
					} else if (path == "") {
						filePath += name;
					} else {
						filePath += "/" + name;
					}

					fetch(`/writeFile`, {
						method: "post",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							data:
								typeof data == "string"
									? data
									: Array.prototype.slice.call(new Uint8Array(data)),
							path: filePath,
						}),
					})
						.then(response => response.json())
						.then(result => {
							if (result?.success) {
								callback();
							} else {
								callback(result?.errorMsg);
							}
						});
				}
			});
		};

		game.removeFile = function removeFile(fileName, callback = () => {}, error = () => {}) {
			fetch(`/removeFile?fileName=${fileName}`)
				.then(response => response.json())
				.then(result => {
					callback(result.errorMsg);
				})
				.catch(error);
		};

		game.getFileList = function getFileList(dir, callback = () => {}, onerror) {
			fetch(`/getFileList?dir=${dir}`)
				.then(response => response.json())
				.then(result => {
					if (!result) {
						throw new Error("Cannot get available resource.");
					}

					if (result.success) {
						callback(result.data.folders, result.data.files);
					} else if (onerror) {
						onerror(new Error(result.errorMsg));
					}
				});
		};

		game.ensureDirectory = function ensureDirectory(list, callback = () => {}, file = false) {
			let pathArray = typeof list == "string" ? list.split("/") : list;
			if (file) {
				pathArray = pathArray.slice(0, -1);
			}
			game.createDir(pathArray.join("/"), callback, console.error);
		};

		game.createDir = function createDir(
			directory,
			successCallback = () => {},
			errorCallback = () => {}
		) {
			fetch(`/createDir?dir=${directory}`)
				.then(response => response.json())
				.then(result => {
					if (result?.success) {
						successCallback();
					} else {
						errorCallback(new Error("创建文件夹失败"));
					}
				})
				.catch(errorCallback);
		};

		game.removeDir = function removeDir(
			directory,
			successCallback = () => {},
			errorCallback = () => {}
		) {
			fetch(`/removeDir?dir=${directory}`)
				.then(response => response.json())
				.then(result => {
					if (result?.success) {
						successCallback();
					} else {
						errorCallback(new Error("创建文件夹失败"));
					}
				})
				.catch(errorCallback);
		};
	} else {
		// 静态托管兼容模式：无后端文件服务，使用HTTP请求直接访问静态文件
		game.checkFile = function checkFile(fileName, callback, onerror) {
			fetch(fileName, { method: "HEAD" })
				.then(response => {
					if (response.ok) {
						callback?.(1);
					} else {
						callback?.(-1);
					}
				})
				.catch(() => callback?.(-1));
		};

		game.checkDir = function checkDir(dir, callback, onerror) {
			// 静态托管无法判断目录，统一返回-1
			callback?.(-1);
		};

		game.readFile = function readFile(fileName, callback = () => {}, error = () => {}) {
			fetch(fileName)
				.then(response => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.arrayBuffer();
				})
				.then(buffer => callback(buffer))
				.catch(error);
		};

		game.readFileAsText = function readFileAsText(fileName, callback = () => {}, error = () => {}) {
			fetch(fileName)
				.then(response => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.text();
				})
				.then(text => callback(text))
				.catch(error);
		};

		game.writeFile = function writeFile(data, path, name, callback = () => {}) {
			console.warn("静态托管模式下不支持写文件操作");
			callback();
		};

		game.removeFile = function removeFile(fileName, callback = () => {}, error = () => {}) {
			console.warn("静态托管模式下不支持删除文件操作");
			callback();
		};

		game.getFileList = function getFileList(dir, callback = () => {}, onerror) {
			console.warn("静态托管模式下不支持列出文件操作");
			callback([], []);
		};

		game.ensureDirectory = function ensureDirectory(list, callback = () => {}, file = false) {
			callback();
		};

		game.createDir = function createDir(
			directory,
			successCallback = () => {},
			errorCallback = () => {}
		) {
			console.warn("静态托管模式下不支持创建目录操作");
			successCallback();
		};

		game.removeDir = function removeDir(
			directory,
			successCallback = () => {},
			errorCallback = () => {}
		) {
			console.warn("静态托管模式下不支持删除目录操作");
			successCallback();
		};
	}
}

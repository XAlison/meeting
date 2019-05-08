/**
 * api server
 * 依赖axios，对axios的config选项添加errorHandler属性用于错误处理
 * Created by xian on 2017/4/25.
 */
import apiBase from './apiBase'
import config from '../../config'
import Qs from "qs"

const _defaultOption = {
	baseURL: config.apiServer,
	timeout: 20000,
	headers: {
		'Content-Type': "application/x-www-form-urlencoded"
	},
	transformRequest: [data => Qs.stringify(data)], //[function,...]|False
	errorHandler: error => {
		//对返回的错误进行一些处理
		const response = error.response;
		console.warn('!!! api error', error.response)
		switch (response.status) {
			case 401:
				break
			case 409:
				let detail1 = ''
				detail1 += response.data.detail
				alert(detail1)
				break
			default:
				let detail = ''
				if (400 <= response.status < 500) {
					detail += ''
				} else if (500 <= response.status < 600) {
					detail += '服务器开小差了，请稍后重新打开! '
				}
				// detail+=response.status + response.data.detail
				if (response.status != 404 && response.data.detail) {
					detail += response.data.detail;
					alert(detail)
				}
				break
		}
		return Promise.reject(error);
	}
}
//新实例化一个api类
const _axios = function(option) {
	return new api(option)
}


const getTemplatesData = function(inputName) {
	const toJson = function(jsonStr) {
		let data = jsonStr
		try {
			data = JSON.parse(jsonStr)
		} catch (error) {}
		return data
	}
	return new Promise(function(resolve, reject) {
		try {
			console.log("---------------------->", inputName)
			const jsonStr = document.querySelector('[name="' + inputName + '"]').value;
			const data = toJson(jsonStr)
			resolve(data)
		} catch (error) {
			console.warn("!!!not find input:" + inputName)
			reject(error)
		}
	});
}



class api extends apiBase {
	constructor(options, isDefault) {
		super(options, isDefault);
	}
	// 获取Token
	authToken(data,params) {
		return this.client.post('/api/v1/system/auth-token/', data, params)
	}
// 获取roomToken
	getRoomToken(params = {}) {
		return this.client.get("/api/fetch/room/token/", {
			params: params
		})
	}
}


export default new api(_defaultOption, true)

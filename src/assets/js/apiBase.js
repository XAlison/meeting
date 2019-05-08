
import axios from 'axios'
import cookie from 'js-cookie'
let _defaultClient = null
const apiBase = class {
  constructor (option, isDefault) {
    this.opt = option
    if (isDefault && _defaultClient !== null) {
      this.client = _defaultClient
    } else {
      this.client = this._newClient(this.opt)
      if (isDefault) {
        _defaultClient = this.client
      }
    }
  }
// 	get token(){
// 	  return cookie.get(config.tokenCookieName)
// 	}
  _newClient (option) {
    const client = axios.create(option)
    /* 请求时如果存在指定cookie,则在header中添加token */
    client.interceptors.request.use(config => {
      if (this.token) {
        config.headers.Authorization = 'JWT ' + this.token
      }
			 return config
    }, function (error) {
      return Promise.reject(error)
    })
    return client
  }
  

  /**
   * 更新 token
   * @param token
   */
  updateApiToken (token) {
		console.log('token',token)
    this.client.defaults.headers.common['Authorization'] = 'JWT ' + token
  }
}

export default apiBase

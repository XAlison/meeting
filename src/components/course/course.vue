<template>
	<div class="">
		<div id="videoPlay" class="video-box clearfix">

			<div id="localplayer" class="remote-player local-player">
				<div class="mute-btn">
					<i class="fa fa-microphone" :class="{'red':microphone}" aria-hidden="true" @click.stop="controllMic"></i>

				</div>
				<div class="kitchout-btn">
					<i class="fa fa-camera" :class="{'red':camera}" aria-hidden="true" @click.stop="controlCamera"></i>
				</div>
			</div>
			<div id="remoteplayer0" class="remote-player remote-player1">
			</div>
			<div id="remoteplayer1" class="remote-player remote-player2">

			</div>
			<div id="remoteplayer2" class="remote-player remote-player3">

			</div>

			<div id="remoteplayer3" class="remote-player remote-player4">


			</div>

			<div id="remoteplayer4" class="remote-player remote-player5">

			</div>

		</div>
	</div>
</template>

<script>
	import $ from 'jquery'
	import api from '../../assets/js/apiServer'
	import swal from 'sweetalert'
	const QNRTC = require('pili-rtc-web');

	export default {
		data() {
			return {
				microphone: false,
				camera: false,
				streamObj: null
			}
		},
		created: function() {
			api.authToken({
				app_id: '998729967052842',
				app_secret: '8ce633f693afbd13edac718bc87602ca'
			}).then(resp => {
				api.updateApiToken(resp.data.result.access_token)
				this.getRoom()
			})
		},
		mounted: function() {
			let vm = this
			$('.remote-player').on('click', function() {
				if (this.querySelector('video')) {
					// 获得 id ,并给下面的元素 
					$(this).find('.mute-btn').attr('userid', $(this).attr('data-user-id'))
					document.querySelector('.local-player').className = this.className;
					this.className = 'remote-player local-player';
				}
			});

		},
		methods: {
			getRoom() {
				let vm = this
				// 视频会议
				api.getRoomToken({
					permission: 'admin',
					course_id: '7422'
				}).then(resp => {
					const myRTC = new QNRTC.StreamModeSession();
					myRTC.joinRoomWithToken(resp.data, JSON.stringify({
						formtype: 'pc',
						userType: 'webRTC'
					})).then(users => {
						vm.myRTC = myRTC;
						// 页面离开时，主动退出房间
						window.onbeforeunload = function() {
							myRTC.leaveRoom();
						};
						// 监听用户发布事件
						myRTC.on('user-publish', user => {
							if (user.published && user.userId !== myRTC.userId) {

								let videoElement = '#remoteplayer';
								let currentIndex = 1;
								for (var i = 0; i < 5; i++) {
									if (!(document.querySelector(videoElement + i + ' video'))) {
										videoElement = 'remoteplayer' + i;
										currentIndex = i + 1;
										break;
									}
								}
								myRTC.subscribe(user.userId).then(remoteStream => {
									const remoteVideo = document.getElementById(videoElement);
									remoteVideo.dataset.userId = user.userId;
									// 同样，调用 play 方法，选择页面上准备好用来播放的元素，就可以播放啦
									remoteStream.play(remoteVideo, false);
									remoteVideo.querySelector('.mute-btn .icon').style.display = 'block';
									remoteVideo.querySelector('.kitchout-btn .icon').style.display = 'block';
									// remoteVideo.querySelector('.icon-closed').style.display = 'block';
									remoteVideo.style.background = 'initial'
									if (vm.endWebRTC) {
										vm.confluence()
									}
								})

							}
						})
						// 房间状态改变 
						myRTC.on("room-state-change", roomState => {
							if (roomState == 3) {
								vm.roomState = roomState
							}
							if (roomState == 2 && vm.roomState == 3) {
								vm.confluence()
							}
						})

						// 离开房间
						myRTC.on('user-leave', user => {
							let ele = document.querySelector('[data-user-id="' + user.userId + '"]');
							$(ele).removeAttr('data-user-id');
							$(ele).find('.mute-btn i').removeClass('icon-stopMicrophone').addClass('icon-microphone').hide();
							$(ele).find('.kitchout-btn i').removeClass('icon-stopCamera').addClass('icon-camera').hide();
							$(ele).find('.icon-closed').hide();
							$(ele).removeAttr("style");
						})
						// 监听用户静音事件
						myRTC.on('mute', data => {
							if (data.userId !== myRTC.userId) {
								let eleString = document.querySelector('[data-user-id="' + data.userId + '"]');
								let muteEle = $(eleString).find('.mute-btn i');
								if (data.muteAudio) {
									if (muteEle.hasClass('icon-microphone')) {
										muteEle.removeClass('icon-microphone').addClass('icon-stopMicrophone');
									}
								} else {
									if (muteEle.hasClass('icon-stopMicrophone')) {
										muteEle.removeClass('icon-stopMicrophone').addClass('icon-microphone');
									}
								}
							}
						})
						// 断线重连
						myRTC.on("republish", () => {
							vm.confluence()
						})
						// 获取当前房间所有用户
						let repeatCount = 0;
						for (let i = 0; i < users.length; i += 1) {
							const user = users[i];
							// 加上从哪个端传过来的 
							// 如果这个用户正在发布并且不是自己，我们就订阅他
							if (user.published && user.userId !== myRTC.userId) {
								const remoteVideo = document.getElementById('remoteplayer' + repeatCount);
								remoteVideo.setAttribute('data-user-id', user.userId)
								// remoteVideo.querySelector('.mute-btn').setAttribute('userId',user.userId)
								$('remoteplayer' + repeatCount).find('.mute-btn').attr('userId', user.userId)
								// 通过用户的 userId 订阅目标用户
								// 这里返回和我们最初从本地获取媒体流时的返回格式一样
								// 都是封装后的 Stream 对象
								vm.receiveOthers(user, remoteVideo);
								repeatCount++
							}
						}

						// 使用内置的 deviceManager 对象采集本地媒体数据
						vm.getLocalStream()
					})

				})
			},
			// 根据属性排序 从小到大
			compare(value) {
				return function(a, b) {
					let value1 = a[value];
					let value2 = b[value];
					return value1 - value2;
				}
			},
			// 根据视频位置排序合流
			mergeStream() {
				let vm = this;
				let arr = [];
				let newArr = [];
				let item = document.querySelectorAll('.remote-player');
				for (let i = 0; i < item.length; i++) {
					let userId = item[i].dataset.userId;
					let rect = item[i].getBoundingClientRect();
					arr[i] = {
						x: rect.x ? rect.x : rect.left,
						y: rect.y ? rect.y : rect.top,
						userId: userId
					}
				}
				newArr.push(arr.sort(vm.compare('x')).splice(4, 1)[0]);
				newArr.push(...arr.sort(vm.compare('y')));
				return newArr;
			},
			// 订阅
			receiveOthers(user, ele) {
				this.myRTC.subscribe(user.userId).then(remoteStream => {
					// 同样，调用 play 方法，选择页面上准备好用来播放的元素，就可以播放啦
					remoteStream.play(ele, false);
					ele.style.background = 'initial'
					ele.querySelector('.mute-btn .icon').style.display = 'block';
					ele.querySelector('.kitchout-btn .icon').style.display = 'block';
					// ele.querySelector('.icon-closed').style.display = 'block';
					if (!ele.querySelector('.mute-btn').getAttribute('userId')) {
						ele.querySelector('.mute-btn').setAttribute('userId', user.userId)
					}
				})
			},
			controllMic() {
				this.microphone = !this.microphone;
				this.myRTC.mute(this.microphone, this.camera);
			},
			controlCamera() {
				this.camera = !this.camera;
				this.myRTC.mute(this.microphone, this.camera);
			},
			// 视频合并区
			confluence() {
				let vm = this
				setTimeout(() => {
					let item = vm.mergeStream();
					let localID = $('.local-player ').find('.mute-btn').attr("userId")
					console.log('localID', localID)
					let sum = 0
					for (let i = 0; i < item.length; i++) {
						if (item[i].userId) {
							let obj = {}
							if (item[i].userId === localID) {
								obj = {
									x: 212,
									y: 0,
									w: 1068,
									h: 720,
									hidden: false,
									muted: false
								}
							} else {
								obj = {
										x: 0,
										y: sum * 144,
										w: 212,
										h: 144,
										hidden: false,
										muted: false
									},
									sum++
							}
							vm.myRTC.setMergeStreamLayout(item[i].userId, obj);

						}
					}
				}, 700)
			},
			// 打开摄像头
			getLocalStream() {
				this.myRTC.unpublish()
				if (this.streamObj) {
					this.streamObj.release()
				}
				let obj = {
					video: {
						enabled: true,
						frameRate: 15,
						bitrate: 256,
						height: 352,
						width: 512
					},
					audio: {
						enabled: true
					}
				}
				this.getLocal(obj)
			},
			getLocal: function(obj) {
				let audioinput = 0
				let audiooutput = 0
				let videoinput = 0
				if (QNRTC.deviceManager.deviceInfo.length) {
					let deviceInfo = QNRTC.deviceManager.deviceInfo
					for (let i = 0; i < deviceInfo.length; i++) {
						let device = deviceInfo[i]
						if (device.kind === 'audioinput') {
							audioinput++
						}
						if (device.kind === 'audiooutput') {
							audiooutput++
						}
						if (device.kind === 'videoinput') {
							videoinput++
						}
					}
				} else {
					swal({
						text: "您没有安装摄像头或者麦克风,或者您的摄像头或者麦克风被禁用了",
					})
					return false
				}
				if (!audioinput || !audiooutput) {
					swal({
						text: "您没有安装摄像头或者麦克风,或者您的摄像头或者麦克风被禁用了",
					})
					return false
				} else {
					if (obj.hasOwnProperty('video')) {
						if (!videoinput) {
							swal({
								text: "您没有安装摄像头或者麦克风,或者您的摄像头或者麦克风被禁用了",
							});
							return false
						}
					}
				}
				let myRTC = this.myRTC
				QNRTC.deviceManager.getLocalStream(obj).then(stream => {
					const localVideo = document.getElementById('localplayer')
					localVideo.dataset.userId = myRTC.userId
					stream.play(localVideo, true)
					this.streamObj = stream
					localVideo.querySelector('i').style.display = 'block'
					localVideo.querySelector('i').style.display = 'block'
					localVideo.querySelector('.mute-btn').setAttribute('userId', myRTC.userId)
					myRTC.publish(stream)
					this.confluence()
				})
			}
		}
	}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style>
	body {
		background: #000000;
	}

	.remote-player {
		background-image: url(chat.png);
		background-size: cover;
	}

	#videoPlay {
		width: 1070px;
		height: 600px;
		position: relative;
	}

	.local-player {
		position: absolute;
		top: 0;
		right: 0;
		width: 83%;
		height: 100%;
		transition: all .6s ease;
		border-left: none;
	}

	.remote-player1 {
		position: absolute;
		top: 0;
		left: 0;
		width: 17%;
		height: 20%;
		transition: all ease 0.6s;
	}

	.remote-player2 {
		position: absolute;
		top: 20%;
		left: 0;
		width: 17%;
		height: 20%;
		transition: all ease 0.6s;
	}

	.remote-player3 {
		position: absolute;
		top: 40%;
		left: 0;
		width: 17%;
		height: 20%;
		transition: all ease 0.6s;
	}

	.remote-player4 {
		position: absolute;
		top: 60%;
		left: 0;
		width: 17%;
		height: 20%;
		transition: all ease 0.6s;
	}

	.remote-player5 {
		position: absolute;
		top: 80%;
		left: 0;
		width: 17%;
		height: 20%;
		transition: all ease 0.6s;
	}

	.remote-player1 video,
	.remote-player2 video,
	.remote-player3 video,
	.remote-player4 video,
	.remote-player5 video {
		object-fit: fill !important;
	}

	.remote-player.local-player video {
		object-fit: contain !important;
	}

	.mute-btn {
		position: absolute;
		bottom: 10px;
		left: 30% !important;
		z-index: 10;



	}

	.mute-btn i {
		cursor: pointer;
		font-size: 20px !important;
		color: white;
	}

	.kitchout-btn {
		position: absolute;
		bottom: 10px;
		right: 30% !important;
		z-index: 10;

	}

	.kitchout-btn i {
		cursor: pointer;
		font-size: 20px !important;
		color: white;
	}

	.mute-btn .red,
	.kitchout-btn .red {
		color: red;
	}

	.swal-modal {
		width: 600px;
	}
</style>

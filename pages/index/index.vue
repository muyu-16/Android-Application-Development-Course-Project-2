<template>
	<view class="container">
		<!-- 背景动画 -->
		<view class="bg-animation">
			<view class="gradient-orb orb-1"></view>
			<view class="gradient-orb orb-2"></view>
			<view class="gradient-orb orb-3"></view>
		</view>

		<!-- 顶部标题区域 -->
		<view class="header" :class="{ 'fade-in': showContent }">
			<view class="project-badge">24软件中美</view>
			<view class="project-title">移动应用开发</view>
			<view class="project-subtitle">结课作业展示</view>
		</view>

		<!-- 团队成员区域 -->
		<view class="team-section" :class="{ 'slide-up': showContent }">
			<view class="section-title">小组成员</view>
			<view class="member-cards">
				<view 
					class="member-card" 
					v-for="(member, index) in members" 
					:key="index"
					:style="{ animationDelay: (index * 0.15 + 0.3) + 's' }"
					:class="{ 'card-appear': showContent }"
					@tap="cardTap(index)"
				>
					<view class="avatar">
						<text class="avatar-text">{{ member.name[0] }}</text>
					</view>
					<view class="member-info">
						<text class="member-name">{{ member.name }}</text>
						<text class="member-id">{{ member.id }}</text>
					</view>
					<view class="role-tag">{{ member.role }}</view>
				</view>
			</view>
		</view>

		<!-- 功能入口区域 -->
		<view class="feature-section" :class="{ 'slide-up': showContent }">
			<view class="section-title">功能入口</view>
			<view class="feature-grid">
				<view 
					class="feature-card" 
					:style="{ animationDelay: '0.6s' }"
					:class="{ 'card-appear': showContent }"
					@tap="goToRecord"
				>
					<view class="feature-icon">🎙️</view>
					<text class="feature-name">录音</text>
					<text class="feature-desc">高品质录音与优化</text>
				</view>
			</view>
		</view>

		<!-- 底部装饰 -->
		<view class="footer" :class="{ 'fade-in': showContent }">
			<view class="decorative-line"></view>
			<text class="footer-text">Powered by UniApp</text>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				showContent: false,
				members: [
					{ name: '徐沣', id: '240200177', role: '组长' },
					{ name: '刘子云', id: '240200181', role: '组员' },
					{ name: '宋诚', id: '240200175', role: '组员' },
					{ name: '梁栩浩', id: '240200164', role: '组员' }
				]
			}
		},
		onLoad() {
			// 页面加载后触发动画
			setTimeout(() => {
				this.showContent = true;
			}, 100);
		},
		methods: {
			cardTap(index) {
				// 点击卡片时的交互效果
				uni.showToast({
					title: this.members[index].name,
					icon: 'none'
				});
			},
			goToRecord() {
				uni.navigateTo({
					url: '/pages/record/record'
				});
			}
		}
	}
</script>

<style lang="scss">
	/* 基础变量 */
	$primary-color: #667eea;
	$secondary-color: #764ba2;
	$accent-color: #f093fb;
	$text-light: #ffffff;
	$text-muted: rgba(255, 255, 255, 0.7);

	.container {
		min-height: 100vh;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
		position: relative;
		overflow: hidden;
		padding: 120rpx 40rpx 60rpx;
		box-sizing: border-box;
	}

	/* 背景动画 */
	.bg-animation {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		z-index: 0;
	}

	.gradient-orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.6;
		animation: float 8s ease-in-out infinite;
	}

	.orb-1 {
		width: 400rpx;
		height: 400rpx;
		background: $primary-color;
		top: -100rpx;
		right: -100rpx;
		animation-delay: 0s;
	}

	.orb-2 {
		width: 300rpx;
		height: 300rpx;
		background: $secondary-color;
		bottom: 20%;
		left: -80rpx;
		animation-delay: -3s;
	}

	.orb-3 {
		width: 250rpx;
		height: 250rpx;
		background: $accent-color;
		bottom: -50rpx;
		right: 20%;
		animation-delay: -5s;
	}

	@keyframes float {
		0%, 100% {
			transform: translate(0, 0) scale(1);
		}
		33% {
			transform: translate(30rpx, -30rpx) scale(1.05);
		}
		66% {
			transform: translate(-20rpx, 20rpx) scale(0.95);
		}
	}

	/* 头部区域 */
	.header {
		position: relative;
		z-index: 1;
		text-align: center;
		margin-bottom: 80rpx;
		opacity: 0;
		transform: translateY(-30rpx);
		transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.header.fade-in {
		opacity: 1;
		transform: translateY(0);
	}

	.project-badge {
		display: inline-block;
		padding: 12rpx 32rpx;
		background: linear-gradient(135deg, $primary-color, $secondary-color);
		border-radius: 40rpx;
		font-size: 24rpx;
		color: $text-light;
		font-weight: 500;
		letter-spacing: 2rpx;
		margin-bottom: 24rpx;
		box-shadow: 0 8rpx 32rpx rgba(102, 126, 234, 0.4);
	}

	.project-title {
		font-size: 56rpx;
		font-weight: 700;
		color: $text-light;
		margin-bottom: 16rpx;
		text-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.3);
	}

	.project-subtitle {
		font-size: 32rpx;
		color: $text-muted;
		font-weight: 300;
	}

	/* 团队区域 */
	.team-section {
		position: relative;
		z-index: 1;
		opacity: 0;
		transform: translateY(50rpx);
		transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.team-section.slide-up {
		opacity: 1;
		transform: translateY(0);
	}

	.section-title {
		font-size: 36rpx;
		color: $text-light;
		text-align: center;
		margin-bottom: 40rpx;
		font-weight: 600;
		position: relative;
		
		&::after {
			content: '';
			position: absolute;
			bottom: -16rpx;
			left: 50%;
			transform: translateX(-50%);
			width: 80rpx;
			height: 6rpx;
			background: linear-gradient(90deg, $primary-color, $accent-color);
			border-radius: 3rpx;
		}
	}

	.member-cards {
		display: flex;
		flex-direction: column;
		gap: 24rpx;
	}

	.member-card {
		display: flex;
		align-items: center;
		padding: 32rpx;
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(20rpx);
		border-radius: 24rpx;
		border: 1px solid rgba(255, 255, 255, 0.1);
		opacity: 0;
		transform: translateX(-30rpx);
		transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.member-card.card-appear {
		opacity: 1;
		transform: translateX(0);
	}

	.member-card:active {
		transform: scale(0.98);
		background: rgba(255, 255, 255, 0.12);
	}

	.avatar {
		width: 96rpx;
		height: 96rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, $primary-color, $accent-color);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 24rpx;
		box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
	}

	.avatar-text {
		font-size: 40rpx;
		font-weight: 700;
		color: $text-light;
	}

	.member-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.member-name {
		font-size: 34rpx;
		font-weight: 600;
		color: $text-light;
		margin-bottom: 8rpx;
	}

	.member-id {
		font-size: 26rpx;
		color: $text-muted;
		font-family: 'Courier New', monospace;
		letter-spacing: 2rpx;
	}

	.role-tag {
		padding: 8rpx 20rpx;
		background: linear-gradient(135deg, $primary-color, $secondary-color);
		border-radius: 20rpx;
		font-size: 22rpx;
		color: $text-light;
		font-weight: 500;
	}

	/* 功能入口区域 */
	.feature-section {
		position: relative;
		z-index: 1;
		opacity: 0;
		transform: translateY(50rpx);
		transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
		margin-top: 60rpx;
	}

	.feature-section.slide-up {
		opacity: 1;
		transform: translateY(0);
	}

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 24rpx;
	}

	.feature-card {
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(20rpx);
		border-radius: 24rpx;
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 40rpx 30rpx;
		text-align: center;
		opacity: 0;
		transform: translateY(20rpx);
		transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.feature-card.card-appear {
		opacity: 1;
		transform: translateY(0);
	}

	.feature-card:active {
		transform: scale(0.98);
		background: rgba(255, 255, 255, 0.12);
	}

	.feature-icon {
		font-size: 60rpx;
		margin-bottom: 16rpx;
	}

	.feature-name {
		display: block;
		font-size: 32rpx;
		font-weight: 600;
		color: $text-light;
		margin-bottom: 8rpx;
	}

	.feature-desc {
		font-size: 24rpx;
		color: $text-muted;
	}

	/* 底部装饰 */
	.footer {
		position: relative;
		z-index: 1;
		text-align: center;
		margin-top: 80rpx;
		opacity: 0;
		transition: opacity 0.8s ease 0.5s;
	}

	.footer.fade-in {
		opacity: 1;
	}

	.decorative-line {
		width: 120rpx;
		height: 4rpx;
		background: linear-gradient(90deg, transparent, $primary-color, transparent);
		margin: 0 auto 24rpx;
	}

	.footer-text {
		font-size: 24rpx;
		color: $text-muted;
	}
</style>
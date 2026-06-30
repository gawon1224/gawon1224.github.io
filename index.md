---
layout: homepage
---

## About Me

I am a graduate student at [POSTECH Computer Vision Lab](https://cvlab.postech.ac.kr/lab/), advised by Prof. [Suha Kwak](https://suhakwak.github.io/). My research interests lie in Embodied AI, especially world models for planning.

<!-- 여기에 본인 소개를 자유롭게 채워 넣으세요. 이전 인턴 경험, 학부, 관심 주제 등 -->

## Research Direction

- Realizable World Models.
- Efficient Planning for Embodied AI.

## News

<style>
.news-timeline {
	margin-top: 0.75rem;
	border-left: 2px solid #d9d9d9;
	padding-left: 1.25rem;
}

.news-year {
	position: relative;
	margin-bottom: 1.25rem;
}

.news-year::before {
	content: "";
	position: absolute;
	left: -1.5rem;
	top: 0.45rem;
	width: 0.7rem;
	height: 0.7rem;
	border-radius: 50%;
	background: #111;
}

.news-year-label {
	font-weight: 700;
	font-size: 1.05rem;
	margin-bottom: 0.4rem;
}

.news-items {
	list-style: none;
	margin: 0;
	padding: 0;
}

.news-item {
	display: flex;
	gap: 0.85rem;
	align-items: flex-start;
	margin: 0.35rem 0;
}

.news-date {
	min-width: 5.75rem;
	font-weight: 600;
	color: #666;
	flex-shrink: 0;
}

.news-text {
	flex: 1;
}

@media (max-width: 640px) {
	.news-timeline {
		padding-left: 1rem;
	}

	.news-year::before {
		left: -1.25rem;
	}

	.news-item {
		flex-direction: column;
		gap: 0.15rem;
	}

	.news-date {
		min-width: 0;
	}
}
</style>

<div class="news-timeline">
	<div class="news-year">
		<div class="news-year-label">2026</div>
		<ul class="news-items">
			<li class="news-item">
				<span class="news-date">Feb. 2026</span>
				<span class="news-text">Our paper was accepted to CVPR 2026. 🎉</span>
			</li>
		</ul>
	</div>

	<div class="news-year">
		<div class="news-year-label">2025</div>
		<ul class="news-items">
			<li class="news-item">
				<span class="news-date">Sep. 2025</span>
				<span class="news-text">Our paper was accepted to CoRLW 2025 (Learning to Simulate Robot Worlds).</span>
			</li>
			<li class="news-item">
				<span class="news-date">Feb. 2025</span>
				<span class="news-text">I started my master's degree in Computer Science and Engineering at POSTECH Computer Vision Lab.</span>
			</li>
			<li class="news-item">
				<span class="news-date">Feb. 2025</span>
				<span class="news-text">Our paper was accepted to WACV 2025.</span>
			</li>
		</ul>
	</div>
</div>

{% include_relative _includes/publications.md %}

{% include_relative _includes/services.md %}

{% include_relative _includes/misc.md %}

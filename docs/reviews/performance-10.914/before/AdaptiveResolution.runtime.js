/** Slow, bounded resolution changes keep sustained GPU load near a 60 Hz budget. */
export class AdaptiveResolution {
	fixedRatio;
	maximum;
	ratio;
	elapsed = 0;
	total = 0;
	frames = 0;
	deviceRatio;
	ceiling;
	constructor(deviceRatio, ceiling = 1.5, fixedRatio) {
		this.fixedRatio = fixedRatio;
		this.deviceRatio = Math.max(.75, Number.isFinite(deviceRatio) ? deviceRatio : 1);
		this.ceiling = Math.max(.75, Number.isFinite(ceiling) ? ceiling : 1.5);
		this.maximum = Math.min(this.deviceRatio, this.ceiling);
		this.ratio = this.fixedRatio ?? this.maximum;
	}
	/** Change the user-selected ceiling without jumping above device limits. */
	setCeiling(ceiling) {
		this.ceiling = Math.max(.75, Number.isFinite(ceiling) ? ceiling : 1.5);
		this.maximum = Math.min(this.deviceRatio, this.ceiling);
		this.ratio = this.fixedRatio ?? Math.min(this.ratio, this.maximum);
		this.resetWindow();
		return this.ratio;
	}
	/** Refresh the display-density cap after a resize or fullscreen transition. */
	setDeviceRatio(deviceRatio) {
		if (Number.isFinite(deviceRatio)) {
			this.deviceRatio = Math.max(.75, deviceRatio);
		}
		this.maximum = Math.min(this.deviceRatio, this.ceiling);
		this.ratio = this.fixedRatio ?? Math.min(this.ratio, this.maximum);
		this.resetWindow();
		return this.ratio;
	}
	update(frameMs, active) {
		if (this.fixedRatio !== undefined) return this.ratio = this.fixedRatio;
		if (!active || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 150) {
			this.resetWindow();
			return this.ratio;
		}
		this.elapsed += frameMs;
		this.total += frameMs;
		this.frames++;
		if (this.elapsed < 2e3) return this.ratio;
		const mean = this.total / this.frames;
		if (mean > 21) this.ratio = Math.max(.75, this.ratio - .15);
		else if (mean < 17.5) this.ratio = Math.min(this.maximum, this.ratio + .05);
		this.resetWindow();
		return this.ratio;
	}
	resetWindow() {
		this.elapsed = this.total = this.frames = 0;
	}
}

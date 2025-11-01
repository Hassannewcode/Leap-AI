// --- Leap Engine Tween Manager ---
// A simple tweening engine for smooth animations.

export const tweenManager = `
const tweenManager = (() => {
    let tweens = [];

    const easingFunctions = {
        linear: t => t,
        easeIn: t => t * t,
        easeOut: t => t * (2 - t),
        easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    };

    function create(target, endProps, options) {
        const { duration = 1000, ease = 'linear', onComplete, yoyo = false, repeat = 0 } = options;
        
        const tween = {
            target,
            endProps,
            duration: duration / 1000, // convert ms to seconds
            ease: easingFunctions[ease] || easingFunctions.linear,
            onComplete,
            yoyo,
            repeat,
            _elapsed: 0,
            _isPlaying: false,
            _isReversed: false,
            _repeatsLeft: repeat,
            _startProps: {},
            
            start() {
                this._isPlaying = true;
                this._elapsed = 0;
                this._repeatsLeft = this.repeat;
                
                // Store initial state
                for (const key in this.endProps) {
                    if (this.target.hasOwnProperty(key)) {
                        this._startProps[key] = this.target[key];
                    }
                }
                
                if (!tweens.includes(this)) {
                    tweens.push(this);
                }
                return this;
            },
            
            stop() {
                this._isPlaying = false;
                return this;
            }
        };

        return tween;
    }
    
    function update(deltaTime) {
        if (tweens.length === 0) return;

        let i = tweens.length;
        while (i--) {
            const tween = tweens[i];
            if (!tween._isPlaying) continue;
            
            tween._elapsed += deltaTime;
            
            let progress = Math.min(tween._elapsed / tween.duration, 1);
            if (tween._isReversed) {
                progress = 1 - progress;
            }
            
            const easedProgress = tween.ease(progress);

            for (const key in tween.endProps) {
                const start = tween._startProps[key];
                const end = tween.endProps[key];
                tween.target[key] = start + (end - start) * easedProgress;
            }
            
            if (tween._elapsed >= tween.duration) {
                if (tween.yoyo) {
                    tween._isReversed = !tween._isReversed;
                    tween._elapsed = 0;
                    
                    // Only count a repeat after a full back-and-forth cycle
                    if (tween._isReversed === false) { 
                         if (tween._repeatsLeft > 0 || tween.repeat === Infinity) {
                            if(tween.repeat !== Infinity) tween._repeatsLeft--;
                        } else {
                            finish(tween);
                        }
                    }
                } else if (tween._repeatsLeft > 0 || tween.repeat === Infinity) {
                    if(tween.repeat !== Infinity) tween._repeatsLeft--;
                    tween._elapsed = 0;
                } else {
                    finish(tween);
                }
            }
        }
    }
    
    function finish(tween) {
        tween.stop();
        if (typeof tween.onComplete === 'function') {
            try {
                tween.onComplete();
            } catch (e) {
                console.error("Error in tween onComplete callback:", e);
            }
        }
        tweens = tweens.filter(t => t !== tween);
    }

    return { create, update };
})();
`;

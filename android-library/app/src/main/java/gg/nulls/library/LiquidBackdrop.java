package gg.nulls.library;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.LinearInterpolator;

/** A lightweight animated background: gradients only, so scrolling stays on the GPU fast path. */
final class LiquidBackdrop extends View {
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final int base,end,accent;
    private final boolean animated;
    private ValueAnimator motion;
    private float phase;

    LiquidBackdrop(Context context,int base,int end,int accent,boolean animated){
        super(context);this.base=base;this.end=end;this.accent=accent;this.animated=animated;
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }
    @Override protected void onAttachedToWindow(){
        super.onAttachedToWindow();
        if(animated&&ValueAnimator.areAnimatorsEnabled()){
            motion=ValueAnimator.ofFloat(0f,1f);motion.setDuration(16000);motion.setRepeatCount(ValueAnimator.INFINITE);motion.setInterpolator(new LinearInterpolator());
            motion.addUpdateListener(value->{phase=(float)value.getAnimatedValue();invalidate();});motion.start();
        }
    }
    @Override protected void onDetachedFromWindow(){if(motion!=null)motion.cancel();super.onDetachedFromWindow();}
    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);float w=getWidth(),h=getHeight();if(w<=0||h<=0)return;
        paint.setShader(new LinearGradient(0,0,w,h,new int[]{base,end,base},null,Shader.TileMode.CLAMP));canvas.drawRect(0,0,w,h,paint);
        float angle=(float)(phase*Math.PI*2);orb(canvas,w*(.18f+.08f*(float)Math.sin(angle)),h*(.16f+.05f*(float)Math.cos(angle)),Math.max(w,h)*.46f,withAlpha(accent,.23f));
        orb(canvas,w*(.86f+.05f*(float)Math.cos(angle*.8f)),h*(.42f+.09f*(float)Math.sin(angle*.8f)),Math.max(w,h)*.38f,withAlpha(0xff5ac8fa,.16f));
        orb(canvas,w*(.42f+.1f*(float)Math.sin(angle*.6f+2)),h*(.9f+.04f*(float)Math.cos(angle*.6f)),Math.max(w,h)*.44f,withAlpha(0xffff7ac8,.12f));
        paint.setShader(null);
    }
    private void orb(Canvas canvas,float x,float y,float radius,int color){paint.setShader(new RadialGradient(x,y,radius,new int[]{color,Color.TRANSPARENT},null,Shader.TileMode.CLAMP));canvas.drawCircle(x,y,radius,paint);}
    private static int withAlpha(int color,float alpha){return (Math.round(255*alpha)<<24)|(color&0x00ffffff);}
}

package gg.nulls.library;

import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.text.*;
import android.text.style.ForegroundColorSpan;
import android.widget.TextView;
import android.view.View;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Iterative Lua lexer and viewport-only spans. Source and selection remain complete. */
final class LuaHighlight {
    private static final Set<String> WORDS=new HashSet<>(Arrays.asList("and break do else elseif end false for function if in local nil not or repeat return then true until while continue export type".split(" ")));
    private static final class TokenColor extends ForegroundColorSpan {TokenColor(int color){super(color);}}
    private static boolean word(char c){return c=='_'||c>='a'&&c<='z'||c>='A'&&c<='Z'||c>='0'&&c<='9';}
    private static boolean digit(char c){return c>='0'&&c<='9';}
    private static int closeLong(CharSequence text,int start,int equals){
        int n=text.length();for(int i=start;i<n;i++){if(text.charAt(i)!=']')continue;int j=i+1,k=0;while(j<n&&text.charAt(j)=='='&&k<equals){j++;k++;}if(k==equals&&j<n&&text.charAt(j)==']')return j+1;}return n;
    }
    private static void apply(Spannable text,boolean dark,int from,int to){
        for(TokenColor span:text.getSpans(0,text.length(),TokenColor.class))text.removeSpan(span);
        int n=text.length();for(int i=0;i<n&&i<to;){int start=i,kind=0;char c=text.charAt(i);boolean comment=c=='-'&&i+1<n&&text.charAt(i+1)=='-';if(comment){kind=1;i+=2;}
            if(i<n&&text.charAt(i)=='['){int j=i+1;while(j<n&&text.charAt(j)=='=')j++;if(j<n&&text.charAt(j)=='['){i=closeLong(text,j+1,j-i-1);kind=comment?1:2;if(i>from)span(text,start,i,from,to,kind,dark);continue;}}
            if(comment){while(i<n&&text.charAt(i)!='\n')i++;}
            else if(c=='\"'||c=='\''){kind=2;i++;while(i<n){char next=text.charAt(i++);if(next=='\\')i=Math.min(n,i+1);else if(next==c)break;}}
            else if(word(c)&&!digit(c)){i++;while(i<n&&word(text.charAt(i)))i++;if(i-start<=8&&WORDS.contains(text.subSequence(start,i).toString()))kind=4;}
            else if(digit(c)){kind=3;i++;while(i<n&&(word(text.charAt(i))||text.charAt(i)=='.'))i++;}
            else i++;
            if(kind!=0&&i>from)span(text,start,i,from,to,kind,dark);
        }
    }
    private static void span(Spannable text,int start,int end,int from,int to,int kind,boolean dark){int color=kind==1?(dark?0xff8daa8b:0xff658267):kind==2?(dark?0xffe5b975:0xffa15b28):kind==3?(dark?0xffc4a5ed:0xff7452a6):(dark?0xff8eb9eb:0xff345fba);text.setSpan(new TokenColor(color),Math.max(from,start),Math.min(to,end),Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);}
    static void apply(Spannable text,boolean dark){apply(text,dark,0,text.length());}
    static void attach(TextView view,boolean dark){
        Handler handler=new Handler(Looper.getMainLooper());Rect visible=new Rect();int[] previous={-1,-1};boolean[] dirty={true};
        Runnable paint=()->{if(!view.isAttachedToWindow())return;Layout layout=view.getLayout();if(layout==null||!view.getLocalVisibleRect(visible))return;int first=layout.getLineForVertical(Math.max(0,visible.top-view.getTotalPaddingTop())),last=layout.getLineForVertical(Math.max(0,visible.bottom-view.getTotalPaddingTop()));int from=layout.getLineStart(Math.max(0,first-8)),to=layout.getLineEnd(Math.min(layout.getLineCount()-1,last+8));if(!dirty[0]&&previous[0]==from&&previous[1]==to)return;previous[0]=from;previous[1]=to;dirty[0]=false;CharSequence raw=view.getText();if(!(raw instanceof Spannable)){view.setText(raw,TextView.BufferType.SPANNABLE);raw=view.getText();}apply((Spannable)raw,dark,from,to);};
        view.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence t,int a,int b,int c){}public void onTextChanged(CharSequence t,int a,int b,int c){dirty[0]=true;handler.removeCallbacks(paint);handler.postDelayed(paint,180);}public void afterTextChanged(Editable t){}});
        android.view.ViewTreeObserver.OnScrollChangedListener scroll=()->{handler.removeCallbacks(paint);handler.postDelayed(paint,32);};view.getViewTreeObserver().addOnScrollChangedListener(scroll);
        view.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){handler.post(paint);}public void onViewDetachedFromWindow(View v){handler.removeCallbacks(paint);if(view.getViewTreeObserver().isAlive())view.getViewTreeObserver().removeOnScrollChangedListener(scroll);}});view.post(paint);
    }
}

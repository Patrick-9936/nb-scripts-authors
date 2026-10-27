package gg.nulls.library;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

final class Api {
    static class Failure extends IOException { final int status; Failure(int s,String text){super(text);status=s;} }
    private final CookieManager cookies=new CookieManager(null,CookiePolicy.ACCEPT_ORIGINAL_SERVER);
    private volatile String username="",password="",bearer="";
    private volatile JSONObject me,cachedMe;private volatile long sessionRevision;
    private final Vault vault;
    Api(Vault v){vault=v;cachedMe=vault.readProfile();}
    synchronized JSONObject identity(){return me;}
    synchronized JSONObject visibleIdentity(){return me!=null?me:cachedMe;}
    synchronized JSONObject cachedIdentity(){return cachedMe;}
    synchronized boolean authenticated(){return me!=null;}
    private synchronized JSONObject rememberIdentity(JSONObject identity){me=identity;cachedMe=identity;vault.saveProfile(identity);return identity;}
    synchronized JSONObject login(String u,String p,boolean remember)throws Exception{
        sessionRevision++;cookies.getCookieStore().removeAll();bearer="";me=null;username="";password="";
        JSONObject r;
        try{r=raw("POST","/auth/login",new JSONObject().put("username",u).put("password",p));}
        catch(Failure e){if(e.status==401)throw new Failure(401,"Неверное имя пользователя или пароль.");throw e;}
        bearer=r.optString("token",r.optString("access_token",""));
        try{JSONObject identity=Core.publicUser(raw("GET","/users/me",null));Core.requireUuid(identity.optString("uuid"));rememberIdentity(identity);username=u;password=p;if(remember)vault.save(u,p);else vault.clear();vault.saveProfile(identity);return me;}catch(Exception e){clear();throw e;}
    }
    synchronized JSONObject register(String name,String user,String pass,boolean remember)throws Exception{
        clear();sessionRevision++;JSONObject result=raw("POST","/auth/register",new JSONObject().put("name",name).put("username",user).put("password",pass));bearer=result.optString("token",result.optString("access_token",""));
        try{JSONObject identity=Core.publicUser(raw("GET","/users/me",null));Core.requireUuid(identity.optString("uuid"));rememberIdentity(identity);username=user;password=pass;if(remember)vault.save(user,pass);else vault.clear();vault.saveProfile(identity);return me;}catch(Exception error){clear();throw error;}
    }
    synchronized JSONObject signInConnect(String token,boolean remember)throws Exception{
        clear();sessionRevision++;JSONObject result=raw("POST","/auth/connect",new JSONObject().put("id_token",token));if(!result.optString("sign_up_token").isEmpty())return result;return finishConnectSession(result,remember);
    }
    synchronized JSONObject registerConnect(String token,String name,String user,boolean remember)throws Exception{
        JSONObject result=raw("POST","/auth/connect/register",new JSONObject().put("sign_up_token",token).put("name",name).put("username",user));return finishConnectSession(result,remember);
    }
    private JSONObject finishConnectSession(JSONObject result,boolean remember)throws Exception{
        bearer=result.optString("token",result.optString("access_token",bearer));JSONObject identity=Core.publicUser(raw("GET","/users/me",null));Core.requireUuid(identity.optString("uuid"));rememberIdentity(identity);username=me.optString("username");password="";if(remember){JSONArray stored=new JSONArray();for(HttpCookie cookie:cookies.getCookieStore().getCookies()){if(cookie.hasExpired())continue;stored.put(new JSONObject().put("name",cookie.getName()).put("value",cookie.getValue()).put("domain",cookie.getDomain()).put("path",cookie.getPath()==null?"/":cookie.getPath()).put("secure",cookie.getSecure()).put("httpOnly",cookie.isHttpOnly()));}vault.saveData(new JSONObject().put("session",true).put("bearer",bearer).put("cookies",stored).put("expires",System.currentTimeMillis()+604800000));vault.saveProfile(identity);}return me;
    }
    synchronized boolean restore()throws Exception{JSONObject o=vault.read();if(o==null)return false;if(o.optBoolean("session")){if(o.optLong("expires")<=System.currentTimeMillis()){clear();return false;}cookies.getCookieStore().removeAll();bearer=o.optString("bearer");JSONArray stored=o.optJSONArray("cookies");if(stored!=null)for(int i=0;i<stored.length();i++){JSONObject item=stored.getJSONObject(i);HttpCookie cookie=new HttpCookie(item.getString("name"),item.getString("value"));String domain=item.optString("domain");if(!domain.equals("scripting.nulls.gg")&&!domain.equals(".scripting.nulls.gg")&&!domain.equals("nulls.gg")&&!domain.equals(".nulls.gg"))continue;cookie.setDomain(domain);cookie.setPath(item.optString("path","/"));cookie.setSecure(item.optBoolean("secure",true));cookie.setHttpOnly(item.optBoolean("httpOnly",true));cookies.getCookieStore().add(URI.create(Core.ORIGIN),cookie);}JSONObject identity=Core.publicUser(raw("GET","/users/me",null));Core.requireUuid(identity.optString("uuid"));rememberIdentity(identity);username=me.optString("username");password="";sessionRevision++;return true;}login(o.getString("user"),o.getString("password"),true);return true;}
    synchronized void clear(){me=null;cachedMe=null;username="";password="";bearer="";cookies.getCookieStore().removeAll();vault.clear();}
    synchronized void logout(){try{raw("POST","/auth/logout",null);}catch(Exception ignored){}clear();}
    synchronized List<HttpCookie> webCookies(){return new ArrayList<>(cookies.getCookieStore().getCookies());}
    JSONObject request(String method,String path,JSONObject body)throws Exception{
        long revision=sessionRevision;try{return raw(method,path,body);}catch(Failure e){
            if(e.status!=401)throw e;
            synchronized(this){
                if(username.isEmpty()||password.isEmpty()){clear();throw e;}
                String u=username,p=password;boolean remembered=vault.read()!=null;
                try{if(revision==sessionRevision)login(u,p,remembered);}catch(Exception loginError){clear();throw loginError;}
            }
            try{return raw(method,path,body);}catch(Failure retryError){if(retryError.status==401&&path.endsWith("/content"))throw new Failure(403,"Код этого скрипта недоступен вашему аккаунту.");throw retryError;}
        }
    }
    JSONObject sync(JSONObject body,String expectedAccount)throws Exception{
        try{return syncRaw(body,expectedAccount);}catch(Failure error){if(error.status!=401)throw error;request("GET","/users/me",null);return syncRaw(body,expectedAccount);}
    }
    private JSONObject syncRaw(JSONObject body,String expectedAccount)throws Exception{
        String cookieHeader="",token;
        synchronized(this){if(me==null)throw new Failure(401,"Требуется вход.");if(!expectedAccount.equals(me.optString("uuid")))throw new Failure(409,"Аккаунт изменён.");Map<String,List<String>> values=cookies.get(URI.create(Core.API+"/users/me"),Collections.emptyMap());for(Map.Entry<String,List<String>> value:values.entrySet())if(value.getKey().equalsIgnoreCase("Cookie"))cookieHeader=String.join("; ",value.getValue());token=bearer;}
        HttpURLConnection connection=(HttpURLConnection)new URL("https://esmqzozbwufdixcxgtts.supabase.co/functions/v1/settings-sync").openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(25000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setRequestProperty("x-nulls-cookie",cookieHeader);connection.setRequestProperty("x-nulls-bearer",token);connection.setDoOutput(true);
        try{byte[] data=body.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(data.length);try(OutputStream out=connection.getOutputStream()){out.write(data);}int status=connection.getResponseCode();if(status<200||status>=300)throw new Failure(status,"Синхронизация недоступна. Настройки сохранены на устройстве.");return new JSONObject(read(connection.getInputStream(),1024*1024));}finally{connection.disconnect();}
    }
    JSONObject statistics()throws Exception{
        JSONObject identity=identity();if(identity==null)throw new Failure(401,"Требуется вход.");JSONObject result;
        try{result=sync(new JSONObject().put("op","stats"),identity.getString("uuid"));}catch(Failure error){if(error.status==403)throw new Failure(403,"Недостаточно прав.");throw error;}
        result.put("downloads",JSONObject.NULL);
        HttpURLConnection connection=(HttpURLConnection)new URL("https://api.github.com/repos/Patrick-9936/nb-scripts-authors/releases?per_page=100").openConnection();connection.setConnectTimeout(5000);connection.setReadTimeout(5000);connection.setRequestProperty("Accept","application/vnd.github+json");connection.setRequestProperty("User-Agent","Script-Library");
        try{if(connection.getResponseCode()==200){JSONArray releases=new JSONArray(read(connection.getInputStream(),4*1024*1024));long downloads=0;for(int i=0;i<releases.length();i++){JSONArray assets=releases.getJSONObject(i).optJSONArray("assets");if(assets!=null)for(int j=0;j<assets.length();j++){JSONObject asset=assets.getJSONObject(j);if(asset.optString("name").endsWith(".apk"))downloads+=asset.optLong("download_count");}}result.put("downloads",downloads);}}catch(Exception ignored){}finally{connection.disconnect();}return result;
    }

    synchronized void refreshIdentity()throws Exception{rememberIdentity(Core.publicUser(request("GET","/users/me",null)));}
    synchronized void changePassword(String current,String next,String expectedAccount)throws Exception{
        if(me==null||!expectedAccount.equals(me.optString("uuid")))throw new Failure(409,"Аккаунт изменён.");
        JSONObject body=new JSONObject().put("new_password",next);if(me.optBoolean("has_password",true))body.put("password",current);
        try{raw("PUT","/users/"+expectedAccount+"/password",body);}catch(Failure failure){if(failure.status==401)throw new Failure(400,"Текущий пароль неверен");throw failure;}
        username=me.optString("username");password=next;if(vault.read()!=null)vault.save(username,next);me.put("has_password",true);
    }
    synchronized void connect(String token,String expectedAccount)throws Exception{
        if(me==null||!expectedAccount.equals(me.optString("uuid")))throw new Failure(409,"Аккаунт изменён.");
        raw("POST","/auth/connect",new JSONObject().put("id_token",token));
        JSONObject identity=Core.publicUser(raw("GET","/users/me",null));
        if(!expectedAccount.equals(identity.optString("uuid"))){clear();throw new Failure(409,"Аккаунт изменён.");}me=identity;
        rememberIdentity(identity);
    }
    void telemetry(String client)throws Exception{
        String cookieHeader="",token;synchronized(this){Map<String,List<String>> values=cookies.get(URI.create(Core.API+"/users/me"),Collections.emptyMap());for(Map.Entry<String,List<String>> value:values.entrySet())if(value.getKey().equalsIgnoreCase("Cookie"))cookieHeader=String.join("; ",value.getValue());token=bearer;}
        HttpURLConnection connection=(HttpURLConnection)new URL("https://esmqzozbwufdixcxgtts.supabase.co/functions/v1/settings-sync").openConnection();connection.setConnectTimeout(5000);connection.setReadTimeout(10000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");connection.setRequestProperty("Content-Type","application/json");connection.setRequestProperty("x-nulls-cookie",cookieHeader);connection.setRequestProperty("x-nulls-bearer",token);connection.setDoOutput(true);
        try{byte[] data=new JSONObject().put("op","telemetry").put("platform","android").put("client_id",client).put("version",BuildConfig.VERSION_NAME).toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(data.length);try(OutputStream out=connection.getOutputStream()){out.write(data);}if(connection.getResponseCode()!=200)throw new IOException("usage");try(InputStream in=connection.getInputStream()){read(in,4096);}}finally{connection.disconnect();}
    }
    private JSONObject raw(String method,String path,JSONObject body)throws Exception{
        if(!path.startsWith("/")||path.contains("..")||path.contains("?token"))throw new IllegalArgumentException("Некорректный путь API");
        URI uri=URI.create(Core.API+path);HttpURLConnection c=(HttpURLConnection)uri.toURL().openConnection();c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);c.setRequestMethod(method);c.setRequestProperty("Accept","application/json");
        for(Map.Entry<String,List<String>> entry:cookies.get(uri,Collections.emptyMap()).entrySet())c.setRequestProperty(entry.getKey(),String.join("; ",entry.getValue()));
        if(!bearer.isEmpty())c.setRequestProperty("Authorization","Bearer "+bearer);
        try{if(body!=null||method.equals("POST")||method.equals("PUT")||method.equals("DELETE")){c.setRequestProperty("Content-Type","application/json");if(body!=null){byte[] data=body.toString().getBytes(StandardCharsets.UTF_8);c.setDoOutput(true);c.setFixedLengthStreamingMode(data.length);try(OutputStream out=c.getOutputStream()){out.write(data);}}}
            int status=c.getResponseCode();cookies.put(uri,c.getHeaderFields());
            if(status<200||status>=300){String error=read(c.getErrorStream(),65536),lower=error.toLowerCase(Locale.ROOT);String message=status==409?(path.equals("/auth/connect")?"Этот Null’s Connect уже связан с другим аккаунтом.":"Имя пользователя уже занято."):status==401?"Сессия завершена. Войдите снова.":status==403?"Аккаунту недоступно это действие.":status==404?"Скрипт или автор не найден.":status==429?"Слишком много запросов. Попробуйте позже.":"Сервис ответил HTTP "+status;
                if(path.endsWith("/share")&&(status==400||status==403||status==404)||lower.contains("script cannot be used in a battle")||lower.contains("author is not verified")||lower.contains("author not verified")||lower.contains("author does not have connect"))message="Этот скрипт нельзя использовать в бою, потому что его автор не подтверждён.";
                else if(status==400){if(error.contains("sign_up_token")||error.contains("Sign up token"))message="Подтверждение истекло. Войдите через Null’s Connect снова.";else if(error.contains("OIDC"))message="Не удалось подтвердить Null’s Connect. Повторите вход.";else if(path.startsWith("/auth/register")||path.startsWith("/auth/connect/register"))message="Проверьте имя пользователя, имя и пароль.";else message="Сервис отклонил запрос. Проверьте параметры и права аккаунта.";}
                throw new Failure(status,message);
            }
            String text=read(c.getInputStream(),8*1024*1024);if(text.trim().isEmpty())return new JSONObject();return new JSONObject(text);
        }finally{c.disconnect();}
    }
    static String read(InputStream stream,int limit)throws IOException{if(stream==null)return "";try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>limit)throw new IOException("Файл превышает допустимый размер");out.write(b,0,n);}return out.toString(StandardCharsets.UTF_8.name());}}
    static String authorList()throws IOException{HttpURLConnection c=(HttpURLConnection)new URL(Core.AUTHORS+"?refresh="+System.currentTimeMillis()).openConnection();c.setUseCaches(false);c.setRequestProperty("Cache-Control","no-cache");c.setRequestProperty("Pragma","no-cache");c.setConnectTimeout(15000);c.setReadTimeout(15000);try{if(c.getResponseCode()!=200)throw new IOException("Список авторов временно недоступен");return read(c.getInputStream(),256*1024);}finally{c.disconnect();}}
}

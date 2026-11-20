/** HTTP na mesma origem; Content-Type só é enviado quando há corpo JSON. */
export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const headers=new Headers(options.headers);
  // Fastify rejeita application/json sem corpo em POST/PATCH/DELETE.
  if(options.body!==undefined&&options.body!==null&&!headers.has('Content-Type')){
    headers.set('Content-Type','application/json');
  }
  const response=await fetch(`/api/v1${path}`,{
    ...options,
    credentials:'same-origin',
    headers,
  });
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const detail=typeof data==='object'&&data!==null&&'error' in data
      ? String(data.error) : 'Não foi possível concluir a operação.';
    throw new Error(detail);
  }
  return data as T;
}

/** HTTP na mesma origem do frontend; o proxy Vite encaminha /api ao servidor. */
export async function api<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api/v1${path}`,{
    credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    ...options,
  });
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const detail=typeof data==='object'&&data!==null&&'error' in data
      ? String(data.error) : 'Não foi possível concluir a operação.';
    throw new Error(detail);
  }
  return data as T;
}

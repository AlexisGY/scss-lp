// Pide la landing al servidor. Si no hay conexion, o la respuesta llega cortada
// o no es JSON, el mensaje del navegador esta en ingles y no dice que hacer.
const CONNECTION_MESSAGE = 'No se pudo conectar con el servidor. Vuelve a intentarlo con «Generar página».';

export async function requestLanding(url, fetcher = fetch) {
  try {
    const response = await fetcher(url);
    return { response, result: await response.json() };
  } catch (cause) {
    throw new Error(CONNECTION_MESSAGE, { cause });
  }
}

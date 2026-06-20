const ALLOWED_HOSTS = new Set([
  'pibd.inpi.fr',
  'www.economie.gouv.fr',
  'www.entreprises.gouv.fr',
  'www.epo.org',
  'www.euipo.europa.eu',
  'www.inpi.fr',
  'www.senat.fr',
  'www2.assemblee-nationale.fr',
  'zyn8p9ocp2-dsn.algolia.net'
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  let target;
  try {
    target = new URL(String(req.query.url || ''));
  } catch {
    return res.status(400).json({ error: 'URL invalide' });
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: 'Domaine non autorisé' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(target, {
      headers: {
        'user-agent': 'BriefLayer source monitor/1.0',
        accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/json, */*',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.7'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    if (req.query.probe === '1') {
      return res.status(upstream.ok ? 200 : 502).json({
        ok: upstream.ok,
        status: upstream.status,
        bytes: body.length,
        contentType: upstream.headers.get('content-type') || ''
      });
    }
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('cache-control', 'public, s-maxage=900, stale-while-revalidate=3600');
    res.status(upstream.status).send(body);
  } catch (error) {
    res.status(502).json({ error: error.name === 'AbortError' ? 'Délai dépassé' : 'Source inaccessible' });
  } finally {
    clearTimeout(timer);
  }
};

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeploymentConfig } from '../scripts/deployment.mjs';

const config = () => ({
  apiUrl: 'https://script.google.com/macros/s/READ_TEST/exec',
  adminUrl: 'https://script.google.com/macros/s/ADMIN_TEST/exec?action=admin'
});
test('la publicación exige ambos despliegues y configuración sin secretos', () => {
  assert.equal(validateDeploymentConfig(config()), true);
  for (const data of [{apiUrl:'',adminUrl:''}, {...config(), spreadsheetId:'PRIVATE_TEST'}, {...config(), adminUrl:''}]) {
    assert.throws(() => validateDeploymentConfig(data));
  }
});
test('la publicación rechaza hosts, parámetros, credenciales o acceso administrativo compartido', () => {
  for (const url of ['http://script.google.com/macros/s/READ_TEST/exec', 'https://script.google.com.evil.invalid/macros/s/READ_TEST/exec', 'https://user@script.google.com/macros/s/READ_TEST/exec', 'https://script.google.com/macros/s/READ_TEST/dev', 'https://script.google.com/macros/s/READ_TEST/exec?token=secret']) {
    assert.throws(() => validateDeploymentConfig({...config(),apiUrl:url}));
  }
  assert.throws(() => validateDeploymentConfig({...config(), adminUrl:config().apiUrl + '?action=admin'}));
  assert.throws(() => validateDeploymentConfig({...config(), adminUrl:config().adminUrl + '&email=USER_TEST'}));
});

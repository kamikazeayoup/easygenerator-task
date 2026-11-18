import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'reflect-metadata';
import { SignInDto, SignUpDto } from '../dist/auth/dto/auth.dto.js';
import { AuthRequestPipe } from '../dist/auth/pipes/auth-request.pipe.js';
import { validateAuthRequest } from '../dist/auth/validation/auth-request.validation.js';

const valid = { name: '  Ada  ', email: '  A.da+Course@EXAMPLE.COM  ', password: ' Abc12! ' };
const validateSignIn = (body) => validateAuthRequest(SignInDto, body);
const validateSignUp = (body) => validateAuthRequest(SignUpDto, body);

test('auth validation normalizes email and name and preserves password whitespace', () => {
  const signUp = validateSignUp({ ...valid, admin: true });
  assert.equal(signUp.success, true);
  assert.ok(signUp.data instanceof SignUpDto);
  assert.deepEqual({ ...signUp.data }, {
    name: 'Ada', email: 'a.da+course@example.com', password: ' Abc12! ',
  });
  const signIn = validateSignIn(valid);
  assert.equal(signIn.success, true);
  assert.ok(signIn.data instanceof SignInDto);
  assert.deepEqual({ ...signIn.data }, {
    email: 'a.da+course@example.com', password: ' Abc12! ',
  });
  assert.equal(validateSignUp({ ...valid, name: ' AB ' }).success, false);
  assert.equal(validateSignUp({ ...valid, name: 'A'.repeat(101) }).success, false);
});

test('both routes reject invalid email syntax and enforce the 254-character limit', () => {
  for (const email of ['missing-domain', 'a..b@example.com', '.a@example.com', 'a@-example.com', 'a@example-.com']) {
    assert.equal(validateSignIn({ ...valid, email }).success, false);
    assert.equal(validateSignUp({ ...valid, email }).success, false);
  }
  const domain = [63, 63, 63, 56].map((length) => 'a'.repeat(length)).join('.') + '.com';
  assert.equal(validateSignIn({ ...valid, email: 'a@' + domain }).success, true);
  assert.equal(validateSignIn({ ...valid, email: 'aa@' + domain }).success, false);
});

test('sign-up enforces password length and ASCII character classes', () => {
  for (const password of ['Abc12!x', 'Abcd12  ', 'Abcd12😀', 'Abcdef!!', '۱۲۳abc!!', '123!@#$%', 'é123!@#$']) {
    assert.equal(validateSignUp({ ...valid, password }).success, false, password);
  }
  for (const punctuation of ['!', '/', ':', '@', '[', '\\', '`', '{', '~']) {
    assert.equal(validateSignUp({ ...valid, password: 'Asdf123' + punctuation }).success, true);
  }
  assert.equal(validateSignUp({ ...valid, password: 'A1!' + 'x'.repeat(125) }).success, true);
  assert.equal(validateSignUp({ ...valid, password: 'A1!' + 'x'.repeat(126) }).success, false);
  assert.equal(validateSignUp({ ...valid, password: 'Asdf\n12!' }).success, true);
});

test('sign-in requires only a nonempty bounded password', () => {
  assert.equal(validateSignIn({ ...valid, password: ' ' }).data.password, ' ');
  assert.equal(validateSignIn({ ...valid, password: 'x'.repeat(128) }).success, true);
  assert.equal(validateSignIn({ ...valid, password: '' }).success, false);
  assert.equal(validateSignIn({ ...valid, password: 'x'.repeat(129) }).success, false);
});

test('the pipe reports validation failures as a 400 response without coercing fields', () => {
  const pipe = new AuthRequestPipe(SignUpDto);
  function expectBadRequest(body, fieldErrors, formErrors = []) {
    assert.throws(() => pipe.transform(body), (error) => {
      assert.equal(error.getStatus(), 400);
      assert.deepEqual(error.getResponse(), {
        statusCode: 400,
        message: 'Invalid request.',
        fieldErrors,
        formErrors,
      });
      return true;
    });
  }

  expectBadRequest({ name: ' x ', email: 'invalid', password: null }, {
    name: ['Name must be between 3 and 100 characters.'],
    email: ['Enter a valid email address.'],
    password: ['Password must be a string.'],
  });
  expectBadRequest({ name: 123, email: [[valid.email]], password: ['Example123!'] }, {
    name: ['Name must be a string.'],
    email: ['Email must be a string.'],
    password: ['Password must be a string.'],
  });
  expectBadRequest([], {}, ['Invalid input: expected object, received array']);
});

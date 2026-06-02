import { ProductImageService } from './product-image.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProductImageService URL handling', () => {
  const svc = new ProductImageService();

  beforeAll(() => {
    // Ensure any Open Food Facts lookups return quickly with no products
    mockedAxios.get.mockResolvedValue({ data: { products: [] } });
  });

  it('accepts protocol-relative URLs by converting to https', async () => {
    const input = '//example.com/images/apple.jpg';
    const res = await svc.resolveImage('apple', input);
    expect(res).toBe('https://example.com/images/apple.jpg');
  });

  it('accepts data URIs and returns them unchanged', async () => {
    const dataUri = 'data:image/png;base64,AAAA';
    const res = await svc.resolveImage('banana', dataUri);
    expect(res).toBe(dataUri);
  });

  it('rejects unsupported protocols (ftp) and falls back to seeded image', async () => {
    const ftp = 'ftp://example.com/bad.jpg';
    const res = await svc.resolveImage('milk', ftp);
    // seeded dairy fallback from the service
    const expected = 'https://images.unsplash.com/photo-1550583724-125581f77833?auto=format&fit=crop&q=80&w=400';
    expect(res).toBe(expected);
  });
});

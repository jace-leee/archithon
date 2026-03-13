import { useState } from 'react';
import type { CostResult, FurnitureItem } from '../types';
import { downloadJSON } from '../utils/download';

interface CostEstimateProps {
  furniture: FurnitureItem[];
  onEstimate: (input: {
    from_address: string;
    to_address: string;
    from_floor: number;
    to_floor: number;
    from_elevator: boolean;
    to_elevator: boolean;
  }) => void;
  result: CostResult | null;
  isLoading?: boolean;
}

const formatKRW = (amount: number) =>
  `${amount.toLocaleString('ko-KR')}원`;

export default function CostEstimate({ furniture, onEstimate, result, isLoading }: CostEstimateProps) {
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [fromFloor, setFromFloor] = useState(1);
  const [toFloor, setToFloor] = useState(1);
  const [fromElevator, setFromElevator] = useState(false);
  const [toElevator, setToElevator] = useState(false);

  const handleSubmit = () => {
    onEstimate({
      from_address: fromAddress,
      to_address: toAddress,
      from_floor: fromFloor,
      to_floor: toFloor,
      from_elevator: fromElevator,
      to_elevator: toElevator,
    });
  };

  const inputClass = "w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="bg-gray-800 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4">이사 정보 입력</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">출발지 주소</label>
            <input
              type="text"
              className={inputClass}
              placeholder="서울시 강남구..."
              value={fromAddress}
              onChange={e => setFromAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">도착지 주소</label>
            <input
              type="text"
              className={inputClass}
              placeholder="서울시 마포구..."
              value={toAddress}
              onChange={e => setToAddress(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">출발 층수</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                className={inputClass}
                value={fromFloor}
                onChange={e => setFromFloor(Number(e.target.value))}
              />
              <label className="flex items-center gap-1.5 text-sm text-gray-400 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-500"
                  checked={fromElevator}
                  onChange={e => setFromElevator(e.target.checked)}
                />
                엘리베이터
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">도착 층수</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                className={inputClass}
                value={toFloor}
                onChange={e => setToFloor(Number(e.target.value))}
              />
              <label className="flex items-center gap-1.5 text-sm text-gray-400 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-500"
                  checked={toElevator}
                  onChange={e => setToElevator(e.target.checked)}
                />
                엘리베이터
              </label>
            </div>
          </div>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-3">
          <p className="text-sm text-gray-400">
            이사 가구: <span className="text-white font-medium">{furniture.length}개</span>
            {furniture.length > 0 && (
              <span className="text-gray-500 ml-2">
                ({furniture.reduce((a, f) => a + f.weight_estimate, 0).toFixed(0)}kg 총중량)
              </span>
            )}
          </p>
        </div>

        <button
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
            ${isLoading ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}
          `}
          disabled={isLoading}
          onClick={handleSubmit}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              계산 중...
            </span>
          ) : '견적 산출'}
        </button>
      </div>

      {result && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">견적 결과</h3>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              onClick={() => downloadJSON(result, 'cost-estimate.json')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              JSON 다운로드
            </button>
          </div>

          <div className="space-y-3">
            {result.breakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700">
                <div>
                  <p className="text-white text-sm">{item.item}</p>
                  {item.description && (
                    <p className="text-gray-500 text-xs mt-0.5">{item.description}</p>
                  )}
                </div>
                <span className="text-gray-300 font-medium text-sm">{formatKRW(item.amount)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-600 flex items-center justify-between">
            <span className="text-white font-bold text-lg">총 비용</span>
            <span className="text-blue-400 font-bold text-2xl">{formatKRW(result.total)}</span>
          </div>

          <p className="text-gray-500 text-xs mt-3 text-center">
            * 실제 견적은 현장 확인 후 달라질 수 있습니다
          </p>
        </div>
      )}
    </div>
  );
}

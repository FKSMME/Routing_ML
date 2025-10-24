import sys
import site

print('Python version:', sys.version)
print('Executable:', sys.executable)
print('Site-packages directories:')
for path in site.getsitepackages():
    print(' ', path)

try:
    import tensorflow
except ModuleNotFoundError:
    print('TensorFlow not installed (ModuleNotFoundError)')
else:
    print('TensorFlow version:', tensorflow.__version__)
